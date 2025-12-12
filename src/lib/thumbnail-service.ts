import puppeteer from 'puppeteer'
import ImageKit from 'imagekit'

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

export interface ThumbnailResult {
  url: string
  fileId: string
  thumbnailUrl?: string
}

export async function generateThumbnail(html: string, name?: string): Promise<ThumbnailResult> {
  let browser = null

  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()

    // Set viewport for thumbnail - smaller size for faster rendering
    await page.setViewport({
      width: 400,
      height: 520,
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

    // Additional wait for rendering
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Take screenshot
    const screenshotBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 85,
      clip: {
        x: 0,
        y: 0,
        width: 400,
        height: 520,
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
