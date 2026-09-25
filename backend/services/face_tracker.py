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

face_tracker_service = FaceTracker()
