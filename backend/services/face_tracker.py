import asyncio
import cv2
import os

class FaceTracker:
    def __init__(self):
        # Intentar cargar MediaPipe solutions si existe en la versión instalada
        self.mp_face_detection = None
        try:
            import mediapipe as mp
            if hasattr(mp, "solutions") and hasattr(mp.solutions, "face_detection"):
                self.mp_face_detection = mp.solutions.face_detection
        except Exception:
            pass

        # Fallback ultra confiable con clasificador frontal de OpenCV
        self.cascade = None
        try:
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            if os.path.exists(cascade_path):
                self.cascade = cv2.CascadeClassifier(cascade_path)
        except Exception:
            pass
        
    def _track_faces_sync(self, video_path: str, sample_rate: int) -> list:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return []

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_interval = max(1, int(fps / sample_rate)) if fps > sample_rate else 1
        
        results = []
        frame_count = 0

        # Si MediaPipe solutions está disponible, usarlo
        if self.mp_face_detection:
            try:
                with self.mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5) as face_detection:
                    while cap.isOpened():
                        ret, frame = cap.read()
                        if not ret:
                            break
                            
                        if frame_count % frame_interval == 0:
                            time = frame_count / fps
                            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                            out = face_detection.process(rgb_frame)
                            
                            if out and out.detections:
                                bboxC = out.detections[0].location_data.relative_bounding_box
                                ih, iw, _ = frame.shape
                                results.append({
                                    "time": time,
                                    "x": int(bboxC.xmin * iw),
                                    "y": int(bboxC.ymin * ih),
                                    "width": int(bboxC.width * iw),
                                    "height": int(bboxC.height * ih)
                                })
                        frame_count += 1
                cap.release()
                return results
            except Exception:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                frame_count = 0

        # Fallback: Detección con OpenCV Cascade
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            if frame_count % frame_interval == 0:
                time = frame_count / fps
                ih, iw, _ = frame.shape
                
                detected = False
                if self.cascade:
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    faces = self.cascade.detectMultiScale(gray, 1.2, 5, minSize=(60, 60))
                    if len(faces) > 0:
                        x, y, w, h = faces[0]
                        results.append({
                            "time": time,
                            "x": int(x),
                            "y": int(y),
                            "width": int(w),
                            "height": int(h)
                        })
                        detected = True
                        
                # Si no detectó rostro, centrar por defecto
                if not detected:
                    results.append({
                        "time": time,
                        "x": int(iw // 2 - 100),
                        "y": int(ih // 3),
                        "width": 200,
                        "height": 200
                    })
            frame_count += 1
            
        cap.release()
        return results

    async def track_faces(self, video_path: str, sample_rate: int = 2) -> list:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._track_faces_sync, video_path, sample_rate)

    def calculate_crop_positions(self, face_data: list, video_width: int, video_height: int, target_width: int = 1080, target_height: int = 1920) -> list:
        crops = []
        target_aspect = target_width / target_height
        crop_w = int(video_height * target_aspect)
        crop_h = video_height

        for item in face_data:
            face_center_x = item["x"] + item["width"] // 2
            x = face_center_x - crop_w // 2
            x = max(0, min(x, video_width - crop_w))
            crops.append({
                "time": item["time"],
                "x": x,
                "y": 0,
                "width": crop_w,
                "height": crop_h
            })
            
        return crops

    def smooth_and_downsample(self, face_data: list, interval: float = 1.0, smoothing: float = 0.65) -> list:
        """
        Reduce face tracking data to one keyframe per `interval` seconds,
        then apply exponential moving average to smooth jitter.
        Higher smoothing = more inertia (smoother but slower to react).
        """
        if not face_data or len(face_data) == 0:
            return []
        
        # 1. Group into time buckets and average positions within each bucket
        buckets = {}
        for item in face_data:
            key = int(item["time"] / interval)
            buckets.setdefault(key, []).append(item)
        
        downsampled = []
        for key in sorted(buckets.keys()):
            items = buckets[key]
            n = len(items)
            downsampled.append({
                "time": round(key * interval, 2),
                "x": int(sum(i["x"] for i in items) / n),
                "y": int(sum(i["y"] for i in items) / n),
                "width": int(sum(i["width"] for i in items) / n),
                "height": int(sum(i["height"] for i in items) / n),
            })
        
        if len(downsampled) <= 1:
            return downsampled
        
        # 2. Exponential Moving Average smoothing
        smoothed = [downsampled[0].copy()]
        for i in range(1, len(downsampled)):
            prev = smoothed[-1]
            curr = downsampled[i]
            smoothed.append({
                "time": curr["time"],
                "x": int(prev["x"] * smoothing + curr["x"] * (1 - smoothing)),
                "y": int(prev["y"] * smoothing + curr["y"] * (1 - smoothing)),
                "width": curr["width"],
                "height": curr["height"],
            })
        
        return smoothed

    def build_crop_x_expression(self, face_data: list, video_width: int, video_height: int) -> tuple:
        """
        Build an FFmpeg-compatible expression for the crop filter's x parameter
        that follows detected faces with smooth piecewise-linear interpolation.
        
        Each segment lerps between two keyframe positions:
            x(t) = x0 + (x1-x0) * (t-t0) / (t1-t0)
        
        Returns: (x_expression: str, crop_width: int)
        """
        crop_w = (int(video_height * 9 / 16) // 2) * 2  # 9:16 aspect, even width
        max_x = max(0, video_width - crop_w)
        center_x = max(0, (video_width - crop_w) // 2)
        
        if crop_w >= video_width:
            return "0", min(crop_w, (video_width // 2) * 2)
        
        if not face_data:
            return str(center_x), crop_w
        
        # Calculate crop x for each keyframe (centered on face, clamped)
        keyframes = []
        for item in face_data:
            face_cx = item["x"] + item["width"] // 2
            x = max(0, min(face_cx - crop_w // 2, max_x))
            keyframes.append((round(item["time"], 2), x))
        
        if len(keyframes) == 1:
            return str(keyframes[0][1]), crop_w
        
        # Limit to ~80 keyframes to prevent overly complex FFmpeg expressions
        if len(keyframes) > 80:
            step = max(1, len(keyframes) // 80)
            reduced = keyframes[::step]
            if reduced[-1][0] != keyframes[-1][0]:
                reduced.append(keyframes[-1])
            keyframes = reduced
        
        # Build nested if(lt(t,...), lerp(...), ...) expression
        # Work backwards from the last segment
        expr = str(keyframes[-1][1])
        for i in range(len(keyframes) - 2, -1, -1):
            t0, x0 = keyframes[i]
            t1, x1 = keyframes[i + 1]
            dt = t1 - t0
            if dt < 0.01:
                continue
            dx = x1 - x0
            if dx == 0:
                lerp = str(x0)
            else:
                lerp = f"{x0}+{dx}*(t-{t0})/{dt:.2f}"
            expr = f"if(lt(t,{t1}),{lerp},{expr})"
        
        return expr, crop_w

face_tracker_service = FaceTracker()

