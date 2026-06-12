// Dev-only stand-in for Vercel's serverless runtime: serves the handlers in
// api/ on http://localhost:3001 so the app can be developed without a Vercel
// login (`npm run dev:api`, or proxied through Vite via `npm run dev:full`).
// Run with tsx so the TypeScript handlers can be imported directly.
//
// Body handling mirrors @vercel/node: application/json -> object,
// application/octet-stream -> Buffer, text/plain -> string, else undefined.

import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PORT = 3001

// Minimal .env loader (no dotenv dependency). Values never get logged.
try {
  const envPath = fileURLToPath(new URL('../.env', import.meta.url))
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
    }
  }
} catch {
  console.warn('[dev-api] no .env file found; GROQ_API_KEY must already be set in the environment')
}

const routes = {
  '/api/transcribe': (await import('../api/transcribe.ts')).default,
  '/api/analyze': (await import('../api/analyze.ts')).default,
  '/api/rewrite': (await import('../api/rewrite.ts')).default,
  '/api/debrief': (await import('../api/debrief.ts')).default,
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const handler = routes[url.pathname]

  if (!handler) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'NOT_FOUND' }))
    return
  }

  // Vercel-style request helpers.
  req.query = Object.fromEntries(url.searchParams)
  const raw = await readBody(req)
  const contentType = (req.headers['content-type'] ?? '').split(';')[0].trim()
  if (contentType === 'application/json') {
    try {
      req.body = raw.length > 0 ? JSON.parse(raw.toString('utf8')) : undefined
    } catch {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'INVALID_JSON' }))
      return
    }
  } else if (contentType === 'application/octet-stream') {
    req.body = raw
  } else if (contentType === 'text/plain') {
    req.body = raw.toString('utf8')
  } else {
    req.body = undefined
  }

  // Vercel-style response helpers.
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (payload) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(payload))
    return res
  }
  res.send = (payload) => {
    res.end(payload)
    return res
  }

  try {
    await handler(req, res)
  } catch (error) {
    console.error('[dev-api] handler error:', error instanceof Error ? error.message : error)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'INTERNAL_ERROR' }))
    }
  }
})

server.listen(PORT, () => {
  console.log(`[dev-api] serving api/ routes on http://localhost:${PORT}`)
  console.log(`[dev-api] GROQ_API_KEY ${process.env.GROQ_API_KEY ? 'is set' : 'is MISSING'}`)
})
