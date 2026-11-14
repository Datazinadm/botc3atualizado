import http from 'k6/http';
import { check } from 'k6';
export const options = { vus: 100, duration: '30s' };
export default function () {
  const r = http.get('http://buzeira171central.x10.mx/');
  check(r, { 'status 200': (x) => x.status === 200 });
}
