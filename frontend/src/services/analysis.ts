import { API_URL } from '../constants/config';

export type AnalysisResult =
  | { ok: true; data: any }
  | { ok: false; reason: string };

export function analyzeVideo(uri: string, movement: string): Promise<AnalysisResult> {
  return new Promise(resolve => {
    const ext = uri.split('.').pop()?.toLowerCase() || 'mp4';
    const type = ext === 'mov' ? 'video/quicktime' : 'video/mp4';

    const form = new FormData();
    form.append('file', { uri, name: `clip.${ext}`, type } as any);
    form.append('movement', movement || 'squat');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/analyze`);
    xhr.timeout = 90000; // 90 sec

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        resolve({ ok: false, reason: `Server error ${xhr.status}: ${xhr.responseText}` });
        return;
      }
      try {
        resolve({ ok: true, data: JSON.parse(xhr.responseText) });
      } catch {
        resolve({ ok: false, reason: 'Invalid response from server' });
      }
    };
    xhr.onerror = () => resolve({ ok: false, reason: `Cannot reach server at ${API_URL}` });
    xhr.ontimeout = () => resolve({ ok: false, reason: 'Request timed out' });

    // Content-Type header manually set NAHI karna — XHR khud boundary ke saath lagata hai
    xhr.send(form);
  });
}