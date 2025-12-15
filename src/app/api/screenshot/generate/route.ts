import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer-core'

// Local Chrome paths for development
const LOCAL_CHROME_PATHS = {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  linux: '/usr/bin/google-chrome',
}

async function getBrowser() {
  const isDev = process.env.NODE_ENV === 'development'

  if (isDev) {
    // Use local Chrome for development
    const platform = process.platform as keyof typeof LOCAL_CHROME_PATHS
    const executablePath = LOCAL_CHROME_PATHS[platform] || LOCAL_CHROME_PATHS.linux

    return puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath,
      headless: true,
    })
  } else {
    // Use bundled chromium for production (dynamic import for Turbopack compatibility)
    const chromium = await import('@sparticuz/chromium').then(m => m.default)
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }
}

export async function POST(request: NextRequest) {
  let browser = null

  try {
    const { html, filename } = await request.json()

    if (!html) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 })
    }

    // Launch headless browser
    browser = await getBrowser()

    const page = await browser.newPage()

    // Set viewport to letter size width (8.5" at 96dpi)
    await page.setViewport({
      width: 816,
      height: 1056,
      deviceScaleFactor: 2,
    })

    // Set the HTML content
    await page.setContent(html, {
      waitUntil: ['load', 'networkidle0'],
    })

    // Wait for fonts to load
    await page.evaluate(() => {
      return document.fonts.ready
    })

    // Wait for all images to load
    await page.evaluate(async () => {
      const images = document.querySelectorAll('img')
      await Promise.all(
        Array.from(images).map((img) => {
          if (img.complete) return Promise.resolve()
          return new Promise((resolve) => {
            img.addEventListener('load', resolve)
            img.addEventListener('error', resolve) // Resolve even on error to not block
          })
        })
      )
    })

    // Additional wait for rendering
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Get the actual content height
    const bodyHeight = await page.evaluate(() => {
      return document.body.scrollHeight
    })

    // Resize viewport to fit content
    await page.setViewport({
      width: 816,
      height: Math.max(bodyHeight, 1056),
      deviceScaleFactor: 2,
    })

    // Take screenshot
    const screenshotBuffer = await page.screenshot({
      type: 'png',
      fullPage: true,
    })

    await browser.close()
    browser = null

    // Return the PNG as a downloadable file
    return new NextResponse(Buffer.from(screenshotBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${filename || 'preview'}.png"`,
      },
    })
  } catch (error) {
    console.error('Screenshot generation error:', error)

    if (browser) {
      await browser.close()
    }

    return NextResponse.json(
      { error: 'Failed to generate screenshot' },
      { status: 500 }
    )
  }
}
