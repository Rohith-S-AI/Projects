// js/attend.js
(() => {
  const MODEL_URL = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights";
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const session = LocalStore.getSession(token);

  const sessionInfo = document.getElementById('sessionInfo');
  const faceNote = document.getElementById('faceNote');
  const locNote = document.getElementById('locNote');
  const finalNote = document.getElementById('finalNote');

  if (!token || !session) {
    sessionInfo.innerHTML = '<span style="color:#ef4444">Invalid or expired link. Ask your teacher for a valid session link.</span>';
  } else {
    const left = Math.max(0, session.expiresAt - Date.now());
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    sessionInfo.innerHTML = `Class: <b>${session.className}</b> • Token <span class="kbd">${token}</span><br/>
      Required location: <span class="kbd">${session.lat.toFixed(6)}, ${session.lng.toFixed(6)}</span> • Radius <b>${session.radius} m</b><br/>
      Expires at: <b>${fmt(session.expiresAt)}</b> (time left: ${m}m ${s}s)`;
  }

  // Face verification
  let stream = null, matchedName = null, modelsReady = false;

  async function loadModels() {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    modelsReady = true;
    faceNote.textContent = 'Models loaded';
  }
  loadModels().catch(e => faceNote.textContent = 'Model load error: ' + e.message);

  document.getElementById('startCam').onclick = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      document.getElementById('video').srcObject = stream;
      faceNote.textContent = 'Camera started';
    } catch (e) {
      faceNote.textContent = 'Camera error: ' + e.message;
    }
  };

  document.getElementById('verify').onclick = async () => {
    if (!modelsReady) return alert('Models not loaded yet.');
    if (!stream) return alert('Start camera first.');

    const faces = LocalStore.getFaces();
    const labels = Object.keys(faces);
    if (labels.length === 0) return alert('No enrolled faces – ask teacher to enroll students first.');

    const labeled = labels.map(name => new faceapi.LabeledFaceDescriptors(
      name,
      faces[name].map(arr => new Float32Array(arr))
    ));
    const matcher = new faceapi.FaceMatcher(labeled, 0.55);

    const video = document.getElementById('video');
    const det = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks().withFaceDescriptor();
    if (!det) { faceNote.textContent = 'No face detected. Try again.'; return; }

    const best = matcher.findBestMatch(det.descriptor);
    document.getElementById('detectedName').textContent = best.toString();
    if (best.label === 'unknown') {
      matchedName = null; faceNote.textContent = 'Face not recognized.';
    } else {
      matchedName = best.label; document.getElementById('name').value = matchedName; faceNote.textContent = 'Face verified ✔';
      maybeEnableMark();
    }
  };

  // Location check
  let distanceOK = false;
  let lastLoc = null;

  document.getElementById('checkLoc').onclick = () => {
    locNote.textContent = 'Checking location…';
    navigator.geolocation.getCurrentPosition(pos => {
      lastLoc = pos.coords;
      const d = haversineMeters(session.lat, session.lng, pos.coords.latitude, pos.coords.longitude);
      document.getElementById('distance').textContent = d.toFixed(1);
      if (d <= session.radius) {
        distanceOK = true; locNote.textContent = `Inside zone ✔ (accuracy ~${Math.round(pos.coords.accuracy)} m)`; maybeEnableMark();
      } else {
        distanceOK = false; locNote.textContent = 'Outside the 20 m zone. Move closer and retry.'; maybeEnableMark();
      }
    }, err => { locNote.textContent = 'Location error: ' + err.message; }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
  };

  function maybeEnableMark() {
    const btn = document.getElementById('mark');
    if (!session) return;
    if (Date.now() > session.expiresAt) {
      btn.disabled = true; finalNote.textContent = 'This link has expired.'; return;
    }
    btn.disabled = !(matchedName && distanceOK);
  }

  // Mark attendance
  document.getElementById('mark').onclick = () => {
    if (!session) return alert('Invalid session.');
    if (Date.now() > session.expiresAt) return alert('Link expired.');
    if (!(matchedName && distanceOK)) return alert('Face + location checks must pass.');

    navigator.geolocation.getCurrentPosition(pos => {
      LocalStore.addAttendance(token, { name: matchedName, time: Date.now(), lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      document.getElementById('mark').disabled = true; finalNote.textContent = 'Attendance recorded ✅';
    }, _ => {
      LocalStore.addAttendance(token, { name: matchedName, time: Date.now(), lat: lastLoc?.latitude ?? null, lng: lastLoc?.longitude ?? null, accuracy: lastLoc?.accuracy ?? null });
      document.getElementById('mark').disabled = true; finalNote.textContent = 'Attendance recorded (no fresh GPS) ✅';
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
  };
})();
