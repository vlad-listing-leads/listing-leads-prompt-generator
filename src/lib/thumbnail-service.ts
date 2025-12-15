import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import ImageKit from 'imagekit'

// Local Chrome paths for development
const LOCAL_CHROME_PATHS = {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  linux: '/usr/bin/google-chrome',
}

// Lazy initialization to avoid build errors when env vars are missing
let imagekitClient: ImageKit | null = null

function getImageKitClient(): ImageKit {
  if (!imagekitClient) {
    imagekitClient = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
    })
  }
  return imagekitClient
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
    // Use bundled serverless chromium for production
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }
}

export interface ThumbnailResult {
  url: string
  fileId: string
  thumbnailUrl?: string
}

export async function generateThumbnail(html: string, name?: string): Promise<ThumbnailResult> {
  let browser = null

  try {
    // Launch headless browser
    browser = await getBrowser()

    const page = await browser.newPage()

    // Set viewport to match letter size (8.5x11 inches at 96 DPI = 816x1056)
    // Using a larger width to ensure full template renders properly
    await page.setViewport({
      width: 816,
      height: 1056,
      deviceScaleFactor: 1.5, // Higher resolution for quality
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

    // Take screenshot of the top portion for thumbnail (16:9 aspect ratio crop from top)
    const screenshotBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 90,
      clip: {
        x: 0,
        y: 0,
        width: 816,
        height: 459, // 16:9 aspect ratio (816 / 16 * 9 = 459)
      },
    })

    await browser.close()
    browser = null

    // Generate unique filename
    const timestamp = Date.now()
    const safeName = (name || 'thumbnail').replace(/[^a-zA-Z0-9-_]/g, '_')
    const fileName = `${safeName}_${timestamp}.jpg`

    // Upload to ImageKit
    const uploadResult = await getImageKitClient().upload({
      file: Buffer.from(screenshotBuffer),
      fileName: fileName,
      folder: '/_personalization/thumbnails',
    })

    return {
      url: uploadResult.url,
      fileId: uploadResult.fileId,
      thumbnailUrl: uploadResult.thumbnailUrl,
    }
  } catch (error) {
    if (browser) {
      await browser.close()
    }
    throw error
  }
}
