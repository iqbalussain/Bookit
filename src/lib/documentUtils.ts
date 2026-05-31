import type { Quotation, Invoice, Client, BusinessSettings } from '@/types';
import { currencySymbols } from '@/types';

interface DocumentData {
  type: 'quotation' | 'invoice';
  document: Quotation | Invoice;
  client?: Client;
  settings: BusinessSettings;
}

// Convert number to words for amount display
function numberToWords(num: number, currency: string): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Lakh', 'Crore'];

  const isOmani = currency === 'OMR';
  const currencyUnit = isOmani ? 'Omani Rial' : 'Rupee';
  const currencyUnitPlural = isOmani ? 'Omani Rials' : 'Rupees';

  function convertBelowThousand(n: number): string {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      const tenPlace = Math.floor(n / 10);
      const remainder = n % 10;
      return tens[tenPlace] + (remainder ? ' ' + ones[remainder] : '');
    }
    const hundredPlace = Math.floor(n / 100);
    const afterHundred = n % 100;
    return ones[hundredPlace] + ' Hundred' + (afterHundred ? ' ' + convertBelowThousand(afterHundred) : '');
  }

  const intPart = Math.floor(num);
  const decimalPart = Math.round((num - intPart) * 100);

  if (intPart === 0) {
    return `Zero ${currencyUnitPlural} Only`;
  }

  let result = '';
  let scaleIndex = 0;
  let temp = intPart;

  while (temp > 0) {
    const chunk = temp % (scaleIndex === 0 ? 1000 : scaleIndex === 1 ? 1000 : 10000000);
    if (chunk !== 0) {
      result = convertBelowThousand(chunk) + (scales[scaleIndex] ? ' ' + scales[scaleIndex] : '') + ' ' + result;
    }
    temp = Math.floor(temp / (scaleIndex === 0 ? 1000 : scaleIndex === 1 ? 1000 : 10000000));
    scaleIndex++;
  }

  result = result.trim() + ' ' + (intPart === 1 ? currencyUnit : currencyUnitPlural);

  if (decimalPart > 0) {
    result += ' and ' + convertBelowThousand(decimalPart) + ' Fils';
  }

  result += ' Only';
  return result;
}

// ---------------- FIXED FUNCTION ----------------
export async function generatePDF({ type, document: docData, client, settings }: DocumentData) {
  const pdfBlob = await generatePDFBlob({ type, document: docData, client, settings });

  const filename = `${type}-${docData.number}.pdf`;
  const objectUrl = window.URL.createObjectURL(pdfBlob);

  const anchor = window.document.createElement('a'); // ✅ FIXED
  anchor.href = objectUrl;
  anchor.download = filename;

  window.document.body.appendChild(anchor); // ✅ FIXED
  anchor.click();
  anchor.remove();

  window.URL.revokeObjectURL(objectUrl);
}

// ---------------- WHATSAPP ----------------
export async function shareViaWhatsApp({ type, document: docData, client, settings }: DocumentData) {
  const currencySymbol = currencySymbols[settings.currency];
  const isInvoice = type === 'invoice';

  const netTotal = docData.netTotal;

  const message = encodeURIComponent(
    `Hi ${client?.name || 'Client'},\n\n` +
    `${isInvoice ? 'Invoice' : 'Quotation'}: ${docData.number}\n` +
    `Amount: ${currencySymbol}${netTotal}\n`
  );

  const phone = client?.phone?.replace(/\D/g, '') || '';
  const url = phone
    ? `https://wa.me/${phone}?text=${message}`
    : `https://wa.me/?text=${message}`;

  window.open(url, '_blank');

  // Run PDF generation in the background so share stays user-gesture initiated
  void generatePDF({ type, document: docData, client, settings }).catch((err) => {
    console.error('PDF error:', err);
  });
}
// Helper function to generate PDF as blob
export async function generatePDFBlob({ type, document: docData, client, settings }: DocumentData) {
  const currencySymbol = currencySymbols[settings.currency];
  const isInvoice = type === 'invoice';
  const invoice = isInvoice ? (docData as Invoice) : null;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${docData.number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 40px;
          color: #1a1a2e;
          max-width: 800px;
          margin: 0 auto;
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: flex-start;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .logo-section { display: flex; align-items: center; gap: 12px; }
        .logo { width: 60px; height: 60px; object-fit: contain; }
        .business-name { font-size: 24px; font-weight: bold; color: #3b82f6; }
        .doc-info { text-align: right; }
        .doc-type { 
          font-size: 28px; 
          font-weight: bold; 
          text-transform: uppercase;
          color: ${isInvoice ? '#10b981' : '#3b82f6'};
        }
        .doc-number { font-size: 14px; color: #6b7280; margin-top: 4px; }
        .doc-date { font-size: 14px; color: #6b7280; }
        
        .parties { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 40px;
          margin-bottom: 40px;
        }
        .party-section h3 { 
          font-size: 12px; 
          text-transform: uppercase; 
          color: #6b7280;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }
        .party-name { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
        .party-details { font-size: 14px; color: #4b5563; line-height: 1.6; }
        
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 30px;
        }
        th { 
          background: #f3f4f6; 
          padding: 12px 16px; 
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          color: #6b7280;
          letter-spacing: 0.5px;
        }
        th:last-child { text-align: right; }
        td { 
          padding: 16px; 
          border-bottom: 1px solid #e5e7eb;
          font-size: 14px;
        }
        td:last-child { text-align: right; }
        .item-name { font-weight: 500; }
        .item-desc { font-size: 13px; color: #6b7280; margin-top: 2px; }
        
        .totals { 
          display: flex; 
          justify-content: flex-end;
          margin-bottom: 40px;
        }
        .totals-box { 
          width: 280px;
          background: #f8fafc;
          border-radius: 8px;
          padding: 20px;
        }
        .total-row { 
          display: flex; 
          justify-content: space-between;
          padding: 8px 0;
        }
        .total-row.grand { 
          font-size: 20px; 
          font-weight: bold;
          border-top: 2px solid #e5e7eb;
          margin-top: 8px;
          padding-top: 16px;
          color: #1a1a2e;
        }
        
        .amount-in-words {
          margin-bottom: 30px;
          padding: 15px;
          background: #fafbfc;
          border-radius: 8px;
        }
        .amount-in-words p {
          font-size: 13px;
          color: #4b5563;
          line-height: 1.6;
        }
        
        .notes-section { 
          background: #f8fafc; 
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .notes-section h4 { 
          font-size: 12px; 
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 8px;
        }
        .notes-section p { font-size: 14px; color: #4b5563; line-height: 1.6; }
        
        .footer {
          text-align: center;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #9ca3af;
        }
        
        @media print {
          body { padding: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-section">
          ${settings.logo ? `<img src="${settings.logo}" class="logo" alt="Logo">` : ''}
          <div>
            <div class="business-name">${settings.name || 'Your Business'}</div>
            <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">
              ${settings.email || ''}
              ${settings.phone ? ` • ${settings.phone}<br>` : ''}
              ${settings.address ? `${settings.address}<br>` : ''}
              ${settings.taxNumber ? `GST: ${settings.taxNumber}` : ''}
            </div>
          </div>
        </div>
        <div class="doc-info">
          <div class="doc-type">${type}</div>
          <div class="doc-number">${docData.number}</div>
          <div class="doc-date">Date: ${new Date(docData.createdAt).toLocaleDateString('en-IN')}</div>
          ${isInvoice && invoice ? `<div class="doc-date">Due: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}</div>` : ''}
        </div>
      </div>
        <div class="party-section">
          <h3>Bill To</h3>
          <div class="party-name">${client?.name || 'Client'}</div>
          <div class="party-details">
            ${client?.email ? `${client.email}<br>` : ''}
            ${client?.phone ? `${client.phone}<br>` : ''}
            ${client?.address || ''}
          </div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 50px;">S.No</th>
            <th>Description</th>
            <th style="width: 80px;">Qty</th>
            <th style="width: 120px;">Rate</th>
            <th style="width: 120px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${docData.items.map((item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>
                <div class="item-name">${item.name}</div>
                ${item.description ? `<div class="item-desc">${item.description}</div>` : ''}
              </td>
              <td>${item.quantity}</td>
              <td>${currencySymbol}${item.rate.toLocaleString('en-IN')}</td>
              <td>${currencySymbol}${(item.total + (item.vatApplicable ? (item.vatAmount ?? 0) : 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="totals">
        <div class="totals-box">
          <div class="total-row">
            <span>Subtotal</span>
            <span>${currencySymbol}${docData.items.reduce((s, i) => s + i.total, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="total-row">
            <span>VAT</span>
            <span>${currencySymbol}${docData.items.reduce((s, i) => s + (i.vatApplicable ? (i.vatAmount ?? 0) : 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="total-row">
            <span>Total After VAT</span>
            <span>${currencySymbol}${docData.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="total-row grand">
            <span>Grand Total</span>
            <span>${currencySymbol}${docData.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
      
      <div class="amount-in-words">
        <p><strong>Amount in Words:</strong> ${numberToWords(docData.netTotal, settings.currency)}</p>
      </div>
      
      ${(settings.bankName || settings.bankAccountNumber) ? `
        <div class="notes-section">
          <h4>Account Details</h4>
          <p>
            ${settings.bankName ? `<strong>Bank:</strong> ${settings.bankName}<br>` : ''}
            ${settings.bankAccountNumber ? `<strong>Account No:</strong> ${settings.bankAccountNumber}` : ''}
          </p>
        </div>
      ` : ''}

      ${docData.notes ? `
        <div class="notes-section">
          <h4>Notes</h4>
          <p>${docData.notes}</p>
        </div>
      ` : ''}
      
      ${docData.terms ? `
        <div class="notes-section">
          <h4>Terms & Conditions</h4>
          <p>${docData.terms}</p>
        </div>
      ` : ''}
      
      <div class="footer">
        Thank you for your business!
      </div>
    </body>
    </html>
  `;

  const container = window.document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  window.document.body.appendChild(container);

  try {
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = (html2pdfModule.default ?? html2pdfModule) as any;
    const worker = html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: `${type}-${docData.number}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(container)
      .toPdf();

    return await worker.outputPdf('blob');
  } finally {
    container.remove();
  }
}
