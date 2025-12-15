import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

/**
 * Generates a PDF from HTML content using client-side rendering.
 * Falls back to this when server-side Puppeteer fails.
 */
export async function generatePdfClientSide(
  html: string,
  filename: string
): Promise<Blob> {
  console.log('[PDF] Starting client-side PDF generation...')

  // Create a visible iframe for proper rendering (hidden containers have issues)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '816px'
  iframe.style.height = '1056px'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  try {
    // Write HTML to iframe
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) {
      throw new Error('Could not access iframe document')
    }

    iframeDoc.open()
    iframeDoc.write(html)
    iframeDoc.close()

    // Wait for iframe to load
    await new Promise(resolve => setTimeout(resolve, 500))

    // Wait for images to load in iframe
    const images = iframeDoc.querySelectorAll('img')
    console.log(`[PDF] Waiting for ${images.length} images to load...`)
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

    // Extra delay for rendering
    await new Promise(resolve => setTimeout(resolve, 300))

    console.log('[PDF] Capturing canvas...')

    // Capture iframe body as canvas
    const canvas = await html2canvas(iframeDoc.body, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: true,
      width: 816,
      height: 1056,
      windowWidth: 816,
      windowHeight: 1056,
    })

    console.log(`[PDF] Canvas created: ${canvas.width}x${canvas.height}`)

    // Create PDF with letter size
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: 'letter',
    })

    // Calculate dimensions to fit letter size (8.5 x 11 inches)
    const imgWidth = 8.5
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    // Add image to PDF
    const imgData = canvas.toDataURL('image/jpeg', 0.95)

    // If content is taller than one page, we need to handle pagination
    const pageHeight = 11
    let yPosition = 0
    let remainingHeight = imgHeight

    while (remainingHeight > 0) {
      if (yPosition === 0) {
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight)
      }

      remainingHeight -= pageHeight

      if (remainingHeight > 0) {
        pdf.addPage()
        yPosition -= pageHeight
        pdf.addImage(imgData, 'JPEG', 0, yPosition, imgWidth, imgHeight)
      }
    }

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
