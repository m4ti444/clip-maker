import asyncio
import base64
import hashlib
import logging
import os
import re
from collections import defaultdict, deque
from datetime import datetime
from urllib.parse import urlparse
from starlette.middleware.base import BaseHTTPMiddleware
from cryptography.fernet import Fernet

class RateLimiter:
    """Sliding window rate limiter per IP address."""
    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = defaultdict(deque)
        self.lock = asyncio.Lock()
    
    async def check(self, ip: str) -> bool:
        """Returns True if request is allowed, False if rate limited."""
        now = datetime.now().timestamp()
        async with self.lock:
            q = self.requests[ip]
            while q and now - q[0] > self.window_seconds:
                q.popleft()
            if len(q) >= self.max_requests:
                return False
            q.append(now)
            return True
    
    async def reset(self, ip: str):
        """Reset rate limit for an IP."""
        async with self.lock:
            if ip in self.requests:
                del self.requests[ip]


class InputSanitizer:
    """Sanitizes all user inputs to prevent injection attacks."""
    
    ALLOWED_BASE_DOMAINS = [
        'youtube.com', 'youtu.be', 'twitch.tv', 'kick.com',
        'vimeo.com', 'dailymotion.com', 'tiktok.com', 'x.com', 'twitter.com'
    ]
    
    SHELL_DANGEROUS = [';', '&&', '||', '|', '`', '$(', '>{', '<(', '\n', '\r', '\x00']
    
    @staticmethod
    def sanitize_url(url: str) -> str:
        if not url:
            raise ValueError("URL cannot be empty")
        url = url.strip()
        parsed = urlparse(url)
        if parsed.scheme not in ['http', 'https']:
            raise ValueError("Invalid URL scheme (must be http or https)")
        if not parsed.netloc:
            raise ValueError("Invalid URL format")
        if '@' in parsed.netloc:
            raise ValueError("URL cannot contain credentials")
        
        hostname = (parsed.hostname or '').lower()
        if re.match(r'^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$', hostname):
            raise ValueError("IP addresses are not allowed")
            
        is_allowed = any(
            hostname == d or hostname.endswith('.' + d)
            for d in InputSanitizer.ALLOWED_BASE_DOMAINS
        )
        if not is_allowed:
            raise ValueError(f"Domain '{hostname}' not supported. Supported: YouTube, Twitch, Kick, TikTok, Vimeo")
            
        if '<script' in url.lower() or 'javascript:' in url.lower():
            raise ValueError("Invalid URL content")
            
        return url
    
    @staticmethod  
    def sanitize_filename(filename: str) -> str:
        filename = filename.replace('\x00', '')
        filename = os.path.basename(filename)
        filename = re.sub(r'[^a-zA-Z0-9_\-\.]', '', filename)
        if not filename:
            raise ValueError("Invalid filename")
        if len(filename) > 200:
            filename = filename[-200:]
            
        allowed_exts = {'.mp4', '.webm', '.mkv', '.avi', '.mov', '.ass', '.json', '.txt', '.wav'}
        ext = os.path.splitext(filename)[1].lower()
        if ext and ext not in allowed_exts:
            raise ValueError(f"File extension {ext} not allowed")
        return filename
    
    @staticmethod
    def sanitize_text(text: str, max_length: int = 10000) -> str:
        if not text:
            return ""
        text = text[:max_length]
        text = re.sub(r'<[^>]*>', '', text)
        text = ''.join(char for char in text if ord(char) >= 32 or char in '\n\r\t')
        return text
    
    @staticmethod
    def sanitize_path(path: str, allowed_base: str) -> str:
        resolved_path = os.path.realpath(path)
        resolved_base = os.path.realpath(allowed_base)
        norm_path = os.path.normcase(resolved_path)
        norm_base = os.path.normcase(resolved_base)
        if not (norm_path == norm_base or norm_path.startswith(norm_base + os.sep) or norm_path.startswith(norm_base + "/")):
            raise ValueError(f"Path traversal attempt detected: {path} outside {allowed_base}")
        return resolved_path
    
    @staticmethod
    def validate_video_file(file_path: str) -> bool:
        if not os.path.exists(file_path):
            raise ValueError("File does not exist")
        try:
            with open(file_path, 'rb') as f:
                header = f.read(12)
            
            # ftyp (MP4/MOV)
            if b'ftyp' in header:
                return True
            # MKV/WebM (1A45DFA3)
            if header.startswith(b'\x1a\x45\xdf\xa3'):
                return True
            # AVI (RIFF)
            if header.startswith(b'RIFF'):
                return True
                
            raise ValueError("Invalid video file format")
        except Exception as e:
            raise ValueError(f"File validation failed: {str(e)}")
    
    @staticmethod
    def sanitize_ffmpeg_param(param: str) -> str:
        param_str = str(param)
        for char in InputSanitizer.SHELL_DANGEROUS:
            if char in param_str:
                raise ValueError("Dangerous character in FFmpeg parameter")
        
        # Only allow digits, colons, dots, dashes
        if not re.match(r'^[0-9:\.\-]+$', param_str):
            raise ValueError("Invalid FFmpeg parameter format")
            
        return param_str
    
    @staticmethod
    def sanitize_time_param(time_val: float) -> float:
        try:
            val = float(time_val)
        except (ValueError, TypeError):
            raise ValueError("Invalid time parameter")
        if val < 0 or val >= 86400 or val != val: # val != val checks for NaN
            raise ValueError("Time parameter must be >= 0 and < 86400 (24h) and finite")
        return val


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds security headers to all responses."""
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'"
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        if 'server' in response.headers:
            del response.headers['server']
        return response


class CredentialEncryption:
    """Encrypts/decrypts API credentials for secure transit."""
    
    def __init__(self, secret: str):
        key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
        self._fernet = Fernet(key)
    
    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode()).decode()
    
    def decrypt(self, ciphertext: str) -> str:
        return self._fernet.decrypt(ciphertext.encode()).decode()
    
    def mask_key(self, api_key: str) -> str:
        if not api_key:
            return ""
        if len(api_key) <= 8:
            return "***"
        prefix = api_key[:3]
        suffix = api_key[-3:]
        return f"{prefix}...{suffix}"


class AuditLogger:
    """Logs all security-relevant actions for audit trail."""
    
    def __init__(self, log_file: str = 'audit.log'):
        self.logger = logging.getLogger('audit_logger')
        self.logger.setLevel(logging.INFO)
        
        # Avoid adding multiple handlers if instantiated multiple times
        if not self.logger.handlers:
            handler = logging.FileHandler(log_file)
            formatter = logging.Formatter('[%(asctime)s] [%(levelname)s] [%(ip)s] [%(action)s] %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
    
    def _log(self, level, ip: str, action: str, details: str):
        extra = {'ip': ip or 'unknown', 'action': action}
        self.logger.log(level, details, extra=extra)

    async def log_request(self, request, action: str, details: str = ''):
        ip = request.client.host if request.client else 'unknown'
        self._log(logging.INFO, ip, action, details)
    
    async def log_auth(self, ip: str, provider: str, success: bool, reason: str = ''):
        status = "SUCCESS" if success else "FAILED"
        self._log(logging.INFO, ip, "AUTH", f"Provider: {provider}, Status: {status}, Reason: {reason}")
    
    async def log_file_access(self, ip: str, file_path: str, action: str):
        self._log(logging.INFO, ip, f"FILE_{action.upper()}", f"Path: {file_path}")
    
    async def log_security_event(self, ip: str, event_type: str, details: str):
        self._log(logging.WARNING, ip, event_type, details)


class RequestValidator:
    """Validates request bodies and parameters."""
    
    @staticmethod
    def validate_process_request(data: dict) -> dict:
        if 'url' in data and data['url']:
            data['url'] = InputSanitizer.sanitize_url(data['url'])
        
        min_dur = data.get('min_duration', 5)
        if not (5 <= min_dur <= 300):
            raise ValueError("min_duration must be between 5 and 300")
            
        max_dur = data.get('max_duration', 60)
        if not (10 <= max_dur <= 600):
            raise ValueError("max_duration must be between 10 and 600")
            
        if max_dur <= min_dur:
            raise ValueError("max_duration must be > min_duration")
            
        clip_count = data.get('clip_count', 1)
        if not (1 <= clip_count <= 50):
            raise ValueError("clip_count must be between 1 and 50")
            
        style = data.get('subtitle_style', 'default')
        if style not in ['default', 'hormozi', 'minimal']:
            raise ValueError("Invalid subtitle_style")
            
        return data
    
    @staticmethod
    def validate_campaign_data(data: dict) -> dict:
        if 'name' not in data or not data['name']:
            raise ValueError("Campaign name is required")
            
        name = InputSanitizer.sanitize_text(data['name'], 200)
        if not name:
            raise ValueError("Campaign name is invalid")
        data['name'] = name
            
        if 'description' in data and data['description']:
            data['description'] = InputSanitizer.sanitize_text(data['description'], 5000)
            
        if 'keywords' in data and data['keywords']:
            data['keywords'] = InputSanitizer.sanitize_text(data['keywords'], 1000)
            
        platform = data.get('platform')
        if platform and platform not in ['youtube', 'tiktok', 'instagram', 'twitter', 'linkedin']:
            raise ValueError("Invalid platform")
            
        min_dur = data.get('min_duration', 5)
        max_dur = data.get('max_duration', 60)
        if max_dur <= min_dur:
            raise ValueError("max_duration must be > min_duration")
            
        return data
    
    @staticmethod
    def validate_trim_request(data: dict) -> dict:
        start = InputSanitizer.sanitize_time_param(data.get('start_time', 0))
        end = InputSanitizer.sanitize_time_param(data.get('end_time', 0))
        
        if end <= start:
            raise ValueError("end_time must be > start_time")
            
        if end - start < 1:
            raise ValueError("min duration after trim must be at least 1 second")
            
        data['start_time'] = start
        data['end_time'] = end
        return data
