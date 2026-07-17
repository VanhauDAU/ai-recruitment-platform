"""Small shared helpers for rasterizing immutable PDF artifacts."""

from io import BytesIO

from PIL import Image


def first_pdf_page_image(pdf_bytes, *, width, image_format='PNG', quality=88):
    """Render the first PDF page to an optimized RGB image.

    Persistence and access policy remain with the calling domain.
    """
    try:
        import pypdfium2 as pdfium
    except ImportError as error:  # pragma: no cover - deployment dependency check
        raise RuntimeError('pypdfium2 is unavailable') from error

    document = pdfium.PdfDocument(pdf_bytes)
    try:
        page = document[0]
        try:
            page_width, _ = page.get_size()
            bitmap = page.render(scale=width / page_width)
            try:
                rendered = bitmap.to_pil()
                if rendered.mode in {'RGBA', 'LA'}:
                    image = Image.new('RGB', rendered.size, 'white')
                    image.paste(rendered, mask=rendered.getchannel('A'))
                else:
                    image = rendered.convert('RGB')
            finally:
                bitmap.close()
        finally:
            page.close()
    finally:
        document.close()

    output = BytesIO()
    save_options = {'format': image_format, 'optimize': True}
    if image_format.upper() in {'WEBP', 'JPEG'}:
        save_options['quality'] = quality
    image.save(output, **save_options)
    return output.getvalue()
