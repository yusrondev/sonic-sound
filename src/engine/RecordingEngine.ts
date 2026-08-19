/**
 * Recording Engine — handles microphone input and MediaRecorder
 */

export interface RecordingResult {
  blob: Blob;
  url: string;
  duration: number;
}

class RecordingEngine {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startTime = 0;

  onLevelUpdate?: (level: number) => void;
  private analyser: AnalyserNode | null = null;
  private ctx: AudioContext | null = null;
  private animFrameId: number | null = null;

  async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      return true;
    } catch {
      return false;
    }
  }

  async getDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audioinput');
  }

  async startRecording(deviceId?: string): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    };
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Set up analyser for level metering
    this.ctx = new AudioContext();
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);
    this.startLevelMeter();

    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: 'audio/webm;codecs=opus' });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.startTime = Date.now();
    this.mediaRecorder.start(100); // collect in 100ms chunks
  }

  stopRecording(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) { reject(new Error('No active recording')); return; }
      const duration = (Date.now() - this.startTime) / 1000;

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        this.cleanup();
        resolve({ blob, url, duration });
      };
      this.mediaRecorder.stop();
    });
  }

  pauseRecording() {
    this.mediaRecorder?.pause();
  }

  resumeRecording() {
    this.mediaRecorder?.resume();
  }

  private startLevelMeter() {
    const tick = () => {
      if (!this.analyser) return;
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteTimeDomainData(data);
      let max = 0;
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i] - 128) / 128;
        if (v > max) max = v;
      }
      this.onLevelUpdate?.(max);
      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private cleanup() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}

export const recordingEngine = new RecordingEngine();
