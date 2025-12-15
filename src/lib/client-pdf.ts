import * as htmlToImage from 'html-to-image'
import jsPDF from 'jspdf'

/**
 * Convert CSS lab() and other modern color functions to hex/rgb
 * html2canvas doesn't support lab(), lch(), oklch(), oklab() colors
 */
function convertModernColors(html: string): string {
  let converted = html

  // Replace lab() with RGB approximation based on lightness
  converted = converted.replace(/lab\([^)]+\)/gi, (match) => {
    const values = match.match(/lab\(\s*([\d.]+)%?\s+([\d.-]+)\s+([\d.-]+)/i)
    if (values) {
      const l = parseFloat(values[1])
      const gray = Math.round((l / 100) * 255)
      return `rgb(${gray}, ${gray}, ${gray})`
    }
    return '#808080'
  })

  // Replace other modern color functions
  converted = converted.replace(/oklch\([^)]+\)/gi, '#808080')
  converted = converted.replace(/oklab\([^)]+\)/gi, '#808080')
  converted = converted.replace(/lch\([^)]+\)/gi, '#808080')

  return converted
}

/**
 * Generates a PDF by capturing the live preview element as an image.
 * Uses html-to-image which preserves text spacing better than html2canvas.
 */
export async function generatePdfFromPreview(
  previewElement: HTMLElement | null,
  filename: string
): Promise<Blob> {
  if (!previewElement) {
    throw new Error('Preview element not found')
  }

  console.log('[PDF] Capturing preview element with html-to-image...')

  // Use toPng for best quality text rendering
  const dataUrl = await htmlToImage.toPng(previewElement, {
    quality: 1,
    pixelRatio: 2, // High resolution for print
    backgroundColor: '#ffffff',
  })

  console.log('[PDF] Image captured successfully')

  // Create an image to get dimensions
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = dataUrl
  })

  console.log(`[PDF] Image size: ${img.width}x${img.height}`)

  // Create PDF with letter size
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter',
  })

  // Fit to letter size (8.5 x 11 inches)
  const pageWidth = 8.5
  const pageHeight = 11
  const imgAspect = img.width / img.height
  const pageAspect = pageWidth / pageHeight

  let pdfImgWidth, pdfImgHeight, offsetX, offsetY

  if (imgAspect > pageAspect) {
    pdfImgWidth = pageWidth
    pdfImgHeight = pageWidth / imgAspect
    offsetX = 0
    offsetY = (pageHeight - pdfImgHeight) / 2
  } else {
    pdfImgHeight = pageHeight
    pdfImgWidth = pageHeight * imgAspect
    offsetX = (pageWidth - pdfImgWidth) / 2
    offsetY = 0
  }

  pdf.addImage(dataUrl, 'PNG', offsetX, offsetY, pdfImgWidth, pdfImgHeight)

  console.log('[PDF] PDF generated successfully')
  return pdf.output('blob')
}

/**
 * Generates a PDF from HTML content using client-side rendering.
 * Falls back to this when server-side Puppeteer fails.
 */
export async function generatePdfClientSide(
  html: string,
  filename: string
): Promise<Blob> {
  console.log('[PDF] Starting client-side PDF generation...')

  // Convert modern CSS colors that html2canvas doesn't support
  const processedHtml = convertModernColors(html)

  // Create iframe for rendering
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '816px'
  iframe.style.height = '1056px'
  iframe.style.border = 'none'
  iframe.style.background = 'white'
  document.body.appendChild(iframe)

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) {
      throw new Error('Could not access iframe document')
    }

    // Write complete HTML document
    iframeDoc.open()
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              width: 816px;
              min-height: 1056px;
              background: white;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
          </style>
        </head>
        <body>${processedHtml}</body>
      </html>
    `)
    iframeDoc.close()

    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 800))

    // Wait for images
    const images = iframeDoc.querySelectorAll('img')
    await Promise.all(
      Array.from(images).map((img) => {
        if (img.complete) return Promise.resolve()
        return new Promise((resolve) => {
          img.onload = resolve
          img.onerror = resolve
        })
      })
    )

    // Wait for fonts
    if (iframeDoc.fonts) {
      await iframeDoc.fonts.ready
    }

    await new Promise(resolve => setTimeout(resolve, 300))

    console.log('[PDF] Capturing with html-to-image...')

    // Capture using html-to-image (better text rendering than html2canvas)
    const dataUrl = await htmlToImage.toPng(iframeDoc.body, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      width: 816,
      height: 1056,
    })

    console.log('[PDF] Image captured')

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [816, 1056],
      hotfixes: ['px_scaling'],
    })

    // Add as full-page image
    pdf.addImage(dataUrl, 'PNG', 0, 0, 816, 1056)

    console.log('[PDF] PDF generated successfully')
    return pdf.output('blob')
  } catch (error) {
    console.error('[PDF] Client-side PDF generation error:', error)
    throw error
  } finally {
    document.body.removeChild(iframe)
  }
}

/**
 * Downloads a PDF from HTML content
 */
export async function downloadPdfClientSide(
  html: string,
  filename: string
): Promise<void> {
  const blob = await generatePdfClientSide(html, filename)

  // Create download link
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
