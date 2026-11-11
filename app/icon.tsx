import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default async function Icon() {
  const logo = await readFile(path.join(process.cwd(), 'src/images/logo.png'));
  const logoData = `data:image/png;base64,${logo.toString('base64')}`;

  return new ImageResponse(
    (
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        border: '3px solid #a78bfa',
        background: '#090711',
        backgroundImage: `url(${logoData})`,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }} />
    ),
    size
  );
}