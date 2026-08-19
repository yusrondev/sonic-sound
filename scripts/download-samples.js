import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public/samples');

const INSTRUMENTS = {
  piano: {
    baseUrl: "https://nbrosowsky.github.io/tonejs-instruments/samples/piano/",
    files: [
      "A1.mp3", "A2.mp3", "A3.mp3", "A4.mp3", "A5.mp3", "A6.mp3", "A7.mp3",
      "C1.mp3", "C2.mp3", "C3.mp3", "C4.mp3", "C5.mp3", "C6.mp3", "C7.mp3", "C8.mp3",
      "Ds1.mp3", "Ds2.mp3", "Ds3.mp3", "Ds4.mp3", "Ds5.mp3", "Ds6.mp3", "Ds7.mp3",
      "Fs1.mp3", "Fs2.mp3", "Fs3.mp3", "Fs4.mp3", "Fs5.mp3", "Fs6.mp3", "Fs7.mp3"
    ]
  },
  "guitar-acoustic": {
    baseUrl: "https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-acoustic/",
    files: [
      "A2.mp3", "A3.mp3", "A4.mp3", "As2.mp3", "As3.mp3", "As4.mp3",
      "B2.mp3", "B3.mp3", "B4.mp3", "C3.mp3", "C4.mp3", "C5.mp3",
      "Cs3.mp3", "Cs4.mp3", "Cs5.mp3", "D2.mp3", "D3.mp3", "D4.mp3", "D5.mp3",
      "Ds2.mp3", "Ds3.mp3", "Ds4.mp3", "E2.mp3", "E3.mp3", "E4.mp3",
      "F2.mp3", "F3.mp3", "F4.mp3", "Fs2.mp3", "Fs3.mp3", "Fs4.mp3",
      "G2.mp3", "G3.mp3", "G4.mp3", "Gs2.mp3", "Gs3.mp3", "Gs4.mp3"
    ]
  },
  "guitar-electric": {
    baseUrl: "https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-electric/",
    files: [
      "A2.mp3", "A3.mp3", "A4.mp3", "A5.mp3", "C3.mp3", "C4.mp3", "C5.mp3", "C6.mp3",
      "Cs2.mp3", "Ds3.mp3", "Ds4.mp3", "Ds5.mp3", "E2.mp3",
      "Fs2.mp3", "Fs3.mp3", "Fs4.mp3", "Fs5.mp3"
    ]
  },
  "guitar-nylon": {
    baseUrl: "https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-nylon/",
    files: [
      "A2.mp3", "A3.mp3", "A4.mp3", "A5.mp3", "As5.mp3",
      "B1.mp3", "B2.mp3", "B3.mp3", "B4.mp3", "Cs3.mp3", "Cs4.mp3", "Cs5.mp3",
      "D2.mp3", "D3.mp3", "D5.mp3", "Ds4.mp3", "E2.mp3", "E3.mp3", "E4.mp3", "E5.mp3",
      "Fs2.mp3", "Fs3.mp3", "Fs4.mp3", "Fs5.mp3", "G3.mp3", "G5.mp3",
      "Gs2.mp3", "Gs4.mp3", "Gs5.mp3"
    ]
  },
  "bass-electric": {
    baseUrl: "https://nbrosowsky.github.io/tonejs-instruments/samples/bass-electric/",
    files: [
      "As1.mp3", "As2.mp3", "As3.mp3", "As4.mp3",
      "Cs1.mp3", "Cs2.mp3", "Cs3.mp3", "Cs4.mp3", "Cs5.mp3",
      "E1.mp3", "E2.mp3", "E3.mp3", "E4.mp3",
      "G1.mp3", "G2.mp3", "G3.mp3", "G4.mp3"
    ]
  },
  violin: {
    baseUrl: "https://nbrosowsky.github.io/tonejs-instruments/samples/violin/",
    files: [
      "A3.mp3", "A4.mp3", "A5.mp3", "A6.mp3",
      "C4.mp3", "C5.mp3", "C6.mp3", "C7.mp3",
      "E4.mp3", "E5.mp3", "E6.mp3",
      "G3.mp3", "G4.mp3", "G5.mp3", "G6.mp3"
    ]
  },
  drum: {
    baseUrl: "https://tonejs.github.io/audio/drum-samples/CR78/",
    files: [
      "kick.mp3", "snare.mp3", "hihat.mp3"
    ]
  }
};

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(destPath)) {
      console.log(`Skipping (already downloaded): ${path.basename(destPath)}`);
      resolve();
      return;
    }

    console.log(`Downloading: ${url}`);
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        fs.unlink(destPath, () => {});
        reject(new Error(`Failed to fetch ${url}: Status ${res.statusCode}`));
        return;
      }
      
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  const tasks = [];
  for (const [instName, inst] of Object.entries(INSTRUMENTS)) {
    const instDir = path.join(PUBLIC_DIR, instName);
    for (const file of inst.files) {
      const url = `${inst.baseUrl}${file}`;
      const destPath = path.join(instDir, file);
      tasks.push({ url, destPath });
    }
  }

  console.log(`Total files to download: ${tasks.length}`);

  // Download files with a concurrency limit of 10
  const CONCURRENCY = 10;
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const chunk = tasks.slice(i, i + CONCURRENCY);
    await Promise.allSettled(chunk.map(task => 
      downloadFile(task.url, task.destPath).catch(err => {
        console.error(`Error downloading ${task.url}:`, err.message);
      })
    ));
  }

  console.log("All sample downloads completed!");
}

main().catch(err => {
  console.error("Main execution failed:", err);
});
