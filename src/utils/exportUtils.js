/**
 * Export data to Excel (.xlsx)
 * @param {Array} data - Array of objects to export
 * @param {String} fileName - Desired file name (without extension)
 * @param {Array} headers - Optional: Array of column headers/keys to include
 */
export const exportToExcel = async (data, fileName = 'export', headers = null) => {
  const { utils, writeFile } = await import('xlsx')
  let exportData = data
  
  // Filter by headers if provided
  if (headers && Array.isArray(headers)) {
    exportData = data.map(item => {
      const filtered = {}
      headers.forEach(h => {
        const key = typeof h === 'string' ? h : h.key
        const label = typeof h === 'string' ? h : h.label
        filtered[label] = item[key]
      })
      return filtered
    })
  }

  const worksheet = utils.json_to_sheet(exportData)
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, worksheet, 'Data')
  writeFile(workbook, `${fileName}.xlsx`)
}

/**
 * Export data to PDF (.pdf)
 * @param {Array} data - Array of objects to export
 * @param {String} fileName - Desired file name (without extension)
 * @param {String} title - Title to display on the PDF
 * @param {Array} headers - Array of header objects { key, label }
 */
export const exportToPDF = async (data, fileName = 'export', title = 'Report', headers = []) => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = jsPDF({ orientation: 'landscape' })
  const safeData = Array.isArray(data) ? data : []
  const safeHeaders = headers.length > 0
    ? headers
    : Object.keys(safeData[0] || {}).map((key) => ({ key, label: key }))
  
  // Add Title
  doc.setFontSize(18)
  doc.text(title, 14, 22)
  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30)

  // Prepare columns and body
  const tableHeaders = safeHeaders.map(h => h.label)
  const tableBody = safeData.map(item => safeHeaders.map(h => {
    const val = item[h.key]
    if (h.formatter && typeof h.formatter === 'function') {
      return h.formatter(val, item)
    }
    return val ?? ''
  }))

  autoTable(doc, {
    startY: 35,
    head: tableHeaders.length ? [tableHeaders] : [['No data']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], textColor: 255 }, // brand-blue
    styles: { fontSize: 9 },
    margin: { top: 35 }
  })

  doc.save(`${fileName}.pdf`)
}
