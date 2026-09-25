import asyncio
import cv2
import mediapipe as mp

class FaceTracker:
    def __init__(self):
        self.mp_face_detection = mp.solutions.face_detection
        
    def _track_faces_sync(self, video_path: str, sample_rate: int) -> list:
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_interval = int(fps / sample_rate) if fps > sample_rate else 1
        
        results = []
        frame_count = 0
        
        with self.mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5) as face_detection:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                    
                if frame_count % frame_interval == 0:
                    time = frame_count / fps
                    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    out = face_detection.process(rgb_frame)
                    
                    if out.detections:
                        # take the first face
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
        
        # Simple smoothing could go here
        return results

    async def track_faces(self, video_path: str, sample_rate: int = 5) -> list:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._track_faces_sync, video_path, sample_rate)

    def calculate_crop_positions(self, face_data: list, video_width: int, video_height: int, target_width: int = 1080, target_height: int = 1920) -> list:
        crops = []
        for face in face_data:
            # Center of the face
            cx = face["x"] + face["width"] // 2
            
            # Target crop width is derived from target aspect ratio
            crop_h = video_height
            crop_w = int(video_height * (target_width / target_height))
            
            crop_x = cx - crop_w // 2
            
            # Boundary checks
            crop_x = max(0, min(crop_x, video_width - crop_w))
            
            crops.append({
                "time": face["time"],
                "x": crop_x,
                "y": 0,
                "w": crop_w,
                "h": crop_h
            })
        return crops

face_tracker_service = FaceTracker()
