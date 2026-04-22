const handler = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const { invoice, rateSheets, bols } = req.body;
    
    const fmtMoney = (n) => '$' + Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const merged = await PDFDocument.create();
    const font = await merged.embedFont(StandardFonts.Helvetica);
    const fontBold = await merged.embedFont(StandardFonts.HelveticaBold);
    
    // PAGE 1: Invoice
    const pg = merged.addPage([612, 792]);
    let y = 742;
    pg.drawText('BHANDARI LOGISTICS LLC', { x:50, y, size:18, font:fontBold });
    pg.drawText('7615 N 90TH ST · OMAHA NE 68122 · MC# 1166353', { x:50, y:y-18, size:9, font, color:rgb(.4,.4,.4) });
    pg.drawText('INVOICE', { x:430, y, size:30, font:fontBold });
    pg.drawText(`# ${invoice.invoiceNumber}`, { x:430, y:y-35, size:18, font:fontBold, color:rgb(.85,.47,.04) });
    y -= 55;
    pg.drawLine({ start:{x:50,y}, end:{x:562,y}, thickness:2, color:rgb(0,0,0) });
    y -= 20;
    pg.drawText(`Date: ${invoice.date||''}`, { x:50, y, size:10, font });
    pg.drawText(`Due: ${invoice.dueDate||'Upon Receipt'}`, { x:220, y, size:10, font });
    pg.drawText(`PO/Load: ${invoice.loadNum||''}`, { x:390, y, size:10, font });
    y -= 30;
    pg.drawText('FROM', { x:50, y, size:8, font:fontBold, color:rgb(.5,.5,.5) });
    pg.drawText('BILL TO', { x:310, y, size:8, font:fontBold, color:rgb(.5,.5,.5) });
    y -= 15;
    pg.drawText('Bhandari Logistics LLC', { x:50, y, size:11, font:fontBold });
    pg.drawText(String(invoice.clientName||''), { x:310, y, size:11, font:fontBold });
    y -= 14;
    pg.drawText('7615 N 90TH ST, Omaha NE 68122', { x:50, y, size:10, font });
    pg.drawText(String(invoice.clientAddress||''), { x:310, y, size:10, font });
    y -= 35;
    pg.drawRectangle({ x:50, y:y-5, width:512, height:22, color:rgb(.12,.18,.24) });
    pg.drawText('DESCRIPTION', { x:58, y, size:9, font:fontBold, color:rgb(1,1,1) });
    pg.drawText('QTY', { x:380, y, size:9, font:fontBold, color:rgb(1,1,1) });
    pg.drawText('RATE', { x:430, y, size:9, font:fontBold, color:rgb(1,1,1) });
    pg.drawText('AMOUNT', { x:495, y, size:9, font:fontBold, color:rgb(1,1,1) });
    y -= 30;
    const base = Number(invoice.baseAmount||invoice.amount||0);
    pg.drawText(`LOAD NUMBER ${invoice.loadNum||''}`, { x:58, y, size:11, font:fontBold });
    pg.drawText(`${invoice.origin||''} to ${invoice.dest||''}`, { x:58, y:y-14, size:9, font, color:rgb(.4,.4,.4) });
    pg.drawText('1', { x:385, y, size:10, font });
    pg.drawText(fmtMoney(base), { x:425, y, size:10, font });
    pg.drawText(fmtMoney(base), { x:493, y, size:10, font:fontBold });
    y -= 35;
    for (const c of (invoice.extraCharges||[]).filter(x=>x&&x.desc&&x.amount)) {
      pg.drawText(String(c.desc), { x:58, y, size:10, font });
      pg.drawText(fmtMoney(c.amount), { x:493, y, size:10, font:fontBold });
      y -= 25;
    }
    y -= 10;
    const total = Number(invoice.amount||0);
    pg.drawText('Subtotal:', { x:400, y, size:10, font });
    pg.drawText(fmtMoney(total), { x:493, y, size:10, font });
    y -= 16;
    pg.drawText('Tax (0%):', { x:400, y, size:10, font });
    pg.drawText('$0.00', { x:493, y, size:10, font });
    y -= 20;
    pg.drawLine({ start:{x:395,y}, end:{x:562,y}, thickness:1, color:rgb(0,0,0) });
    y -= 18;
    pg.drawText('Total:', { x:400, y, size:13, font:fontBold });
    pg.drawText(fmtMoney(total), { x:493, y, size:13, font:fontBold });
    y -= 40;
    pg.drawRectangle({ x:50, y:y-5, width:512, height:42, color:rgb(.85,.47,.04) });
    pg.drawText('BALANCE DUE', { x:70, y:y+12, size:13, font:fontBold, color:rgb(1,1,1) });
    pg.drawText(fmtMoney(total), { x:390, y:y+10, size:20, font:fontBold, color:rgb(1,1,1) });
    y -= 55;
    pg.drawText(`Payment: ACH within ${invoice.paymentTerms||'2'} business days  (402) 591-0847  bhandarilogistics78@gmail.com`, { x:58, y, size:9, font, color:rgb(.2,.4,.8) });

    // Add rate sheets
    for (const rs of (rateSheets||[])) {
      if (!rs) continue;
      try {
        const bytes = Buffer.from(rs.split(',')[1], 'base64');
        if (rs.startsWith('data:application/pdf')) {
          const src = await PDFDocument.load(bytes);
          const pages = await merged.copyPages(src, src.getPageIndices());
          pages.forEach(p => merged.addPage(p));
        } else {
          const isJpg = rs.includes('image/jpeg') || rs.includes('image/jpg');
          const img = isJpg ? await merged.embedJpg(bytes) : await merged.embedPng(bytes);
          const p = merged.addPage([612, 792]);
          const d = img.scaleToFit(562, 742);
          p.drawImage(img, { x:(612-d.width)/2, y:(792-d.height)/2, width:d.width, height:d.height });
        }
      } catch(e) { console.error('RS error:', e.message); }
    }

    // Add BOLs
    for (const b of (bols||[])) {
      if (!b) continue;
      try {
        const bytes = Buffer.from(b.split(',')[1], 'base64');
        if (b.startsWith('data:application/pdf')) {
          const src = await PDFDocument.load(bytes);
          const pages = await merged.copyPages(src, src.getPageIndices());
          pages.forEach(p => merged.addPage(p));
        } else {
          const isJpg = b.includes('image/jpeg') || b.includes('image/jpg');
          const img = isJpg ? await merged.embedJpg(bytes) : await merged.embedPng(bytes);
          const p = merged.addPage([612, 792]);
          const d = img.scaleToFit(562, 742);
          p.drawImage(img, { x:(612-d.width)/2, y:(792-d.height)/2, width:d.width, height:d.height });
        }
      } catch(e) { console.error('BOL error:', e.message); }
    }

    const pdfBytes = await merged.save();
    res.status(200).json({ pdf: Buffer.from(pdfBytes).toString('base64') });

  } catch(e) {
    console.error('Invoice error:', e);
    res.status(500).json({ error: String(e.message) });
  }
};

handler.config = {
  api: { bodyParser: { sizeLimit: '50mb' } }
};

module.exports = handler;
