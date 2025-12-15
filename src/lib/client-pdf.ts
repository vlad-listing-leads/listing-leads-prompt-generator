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
  // Create a hidden container for rendering
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '816px' // Letter width at 96 DPI
  container.style.backgroundColor = 'white'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    // Wait for images to load
    const images = container.querySelectorAll('img')
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
    await document.fonts.ready

    // Small delay for rendering
    await new Promise(resolve => setTimeout(resolve, 100))

    // Capture as canvas
    const canvas = await html2canvas(container, {
      scale: 2, // Higher resolution
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: 816,
      windowWidth: 816,
    })

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
      // For first page, add the image starting from top
      if (yPosition === 0) {
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight)
      }

      remainingHeight -= pageHeight

      // If there's more content, add a new page
      if (remainingHeight > 0) {
        pdf.addPage()
        yPosition -= pageHeight
        // Position the image so the next portion shows
        pdf.addImage(imgData, 'JPEG', 0, yPosition, imgWidth, imgHeight)
      }
    }

    // Return as blob
    return pdf.output('blob')
  } finally {
    // Clean up
    document.body.removeChild(container)
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
