const fs = require('fs');
const path = require('path');
const PDFJS = require('pdf2json');

async function extractPdfToText() {
  const pdfPath = path.join(__dirname, 'public', 'Jean Felipe Sorio - Currículo.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF não encontrado em:', pdfPath);
    process.exit(1);
  }

  const pdfParser = new PDFJS();
  
  pdfParser.on('pdfParser_dataError', (errData) => {
    console.error('❌ Erro ao parsear PDF:', errData.parserError);
    process.exit(1);
  });

  pdfParser.on('pdfParser_dataReady', (pdfData) => {
    // Extrair texto de todas as páginas
    const text = pdfData.pages.map(page => {
      return page.texts.map(text => text.str).join(' ');
    }).join('\n\n');
    
    console.log('=== Texto Extraído do PDF ===');
    console.log(text);
    console.log('');
    console.log('=== Metadados ===');
    console.log('Número de páginas:', pdfData.pages.length);
    
    // Salvar texto raw para facilitar criação do MD
    fs.writeFileSync('cv-raw.txt', text);
    console.log('Salvo em cv-raw.txt');
  });

  pdfParser.loadPDF(pdfPath);
}

extractPdfToText().catch(console.error);
