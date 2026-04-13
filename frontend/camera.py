import cv2

cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not cap.isOpened():
    print("Camera failed to open")
    exit()

cv2.namedWindow("Live PTZ Camera", cv2.WINDOW_NORMAL)

print("Live preview started. Close the window or press ESC to exit.")

while True:
    ret, frame = cap.read()
    if not ret:
        continue

    cv2.imshow("Live PTZ Camera", frame)

    if cv2.waitKey(30) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()
