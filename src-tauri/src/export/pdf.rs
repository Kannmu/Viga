use printpdf::*;

pub struct PdfExporter;

impl PdfExporter {
    pub fn new() -> Self {
        Self
    }

    pub fn export(&self, _document_json: &str) -> Result<Vec<u8>, String> {
        let mut doc = PdfDocument::new("Viga Export");
        let page = PdfPage::new(Mm(210.0), Mm(297.0), vec![]);
        doc.with_pages(vec![page]);
        let mut warnings = Vec::new();
        let bytes = doc.save(&PdfSaveOptions::default(), &mut warnings);
        Ok(bytes)
    }
}
