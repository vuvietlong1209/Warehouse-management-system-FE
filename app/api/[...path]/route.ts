import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: { path: string[] } };

const FORWARDED_RESPONSE_HEADERS = [
  'cache-control',
  'content-disposition',
  'content-type',
  'etag',
  'last-modified',
  'location',
  'set-cookie',
];

function backendUrl(request: NextRequest, path: string[]) {
  const backendBase = process.env.BACKEND_API_URL
    || process.env.NEXT_PUBLIC_API_URL
    || 'http://localhost:4000';
  const target = new URL(`/api/${path.map(encodeURIComponent).join('/')}`, backendBase);
  target.search = request.nextUrl.search;
  return target;
}

async function proxyRequest(request: NextRequest, { params }: RouteContext) {
  const headers = new Headers(request.headers);
  headers.delete('connection');
  headers.delete('content-length');
  headers.delete('host');
  headers.set('accept-encoding', 'identity');

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const target = backendUrl(request, params.path);
  // Replay only reads. A failed write may already have committed upstream.
  const attempts = hasBody ? 1 : 2;

  try {
    const body = hasBody ? await request.arrayBuffer() : undefined;
    let upstream: Response | undefined;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (request.signal.aborted) return new Response(null, { status: 499 });
      try {
        upstream = await fetch(target, {
          method,
          headers,
          body,
          cache: 'no-store',
          redirect: 'manual',
          signal: request.signal,
        });
        break;
      } catch (error) {
        if (request.signal.aborted) return new Response(null, { status: 499 });
        const code = (error as { cause?: { code?: string } })?.cause?.code;
        const transient = ['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'].includes(code || '');
        if (!transient || attempt + 1 === attempts) throw error;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    if (!upstream) throw new Error('Không nhận được phản hồi backend');

    const responseHeaders = new Headers();
    FORWARDED_RESPONSE_HEADERS.forEach(name => {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    const code = (error as { cause?: { code?: string } })?.cause?.code || 'UPSTREAM_CONNECTION_FAILED';
    console.warn(`[API proxy] ${method} ${target.pathname}: ${code}`);
    return NextResponse.json(
      { success: false, message: 'Không thể kết nối dịch vụ kho. Vui lòng kiểm tra backend đang chạy ở cổng đã cấu hình và thử lại.', code },
      { status: 502 },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
export const HEAD = proxyRequest;
