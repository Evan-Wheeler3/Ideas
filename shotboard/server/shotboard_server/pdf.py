"""Shot list PDFs: a storyboard sheet (panels in a grid) or a table."""

import base64
import io
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape, letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import PdfRequest, PdfShot

INK = colors.HexColor("#1d1f24")
MUTED = colors.HexColor("#6b7078")
RULE = colors.HexColor("#d5d8dd")
ACCENT = colors.HexColor("#c97f0a")
PANEL_BG = colors.HexColor("#eceef1")

STYLE_NOTES = ParagraphStyle("notes", fontName="Helvetica", fontSize=8.5, leading=11, textColor=INK, alignment=TA_LEFT)
STYLE_SMALL = ParagraphStyle("small", fontName="Helvetica", fontSize=7.5, leading=9.5, textColor=MUTED)
STYLE_CELL = ParagraphStyle("cell", fontName="Helvetica", fontSize=8.5, leading=10.5, textColor=INK)
STYLE_HEAD = ParagraphStyle("head", fontName="Helvetica-Bold", fontSize=7.5, leading=9, textColor=MUTED)


def _esc(text: str) -> str:
    """Escape text for ReportLab paragraphs and keep line breaks."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")


def _image(shot: PdfShot) -> io.BytesIO | None:
    """The shot's picture as a file-like object, or None if missing or unreadable."""
    if not shot.image:
        return None
    try:
        data = base64.b64decode(shot.image)
        ImageReader(io.BytesIO(data))  # validate
        return io.BytesIO(data)
    except Exception:
        return None


def _seconds(total: float) -> str:
    return f"{int(total // 60)}:{round(total % 60):02d}" if total >= 60 else f"{total:.1f}s"


class _Decorations:
    """Header and footer drawn on every page."""

    def __init__(self, req: PdfRequest):
        self.req = req
        self.total = sum(s.duration for s in req.shots)

    def __call__(self, canvas: Canvas, doc) -> None:
        w, h = doc.pagesize
        canvas.saveState()
        canvas.setFillColor(INK)
        canvas.setFont("Helvetica-Bold", 14)
        canvas.drawString(doc.leftMargin, h - 14 * mm, self.req.title)
        canvas.setFont("Helvetica", 8.5)
        canvas.setFillColor(MUTED)
        info = f"{len(self.req.shots)} shots · {_seconds(self.total)}"
        if self.req.subtitle:
            info = f"{self.req.subtitle}   ·   {info}"
        canvas.drawString(doc.leftMargin, h - 19 * mm, info)
        canvas.drawRightString(w - doc.rightMargin, h - 14 * mm, date.today().strftime("%d %b %Y"))
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.6)
        canvas.line(doc.leftMargin, h - 22 * mm, w - doc.rightMargin, h - 22 * mm)
        canvas.drawString(doc.leftMargin, 8 * mm, "ShotBoard")
        canvas.drawRightString(w - doc.rightMargin, 8 * mm, f"Page {doc.page}")
        canvas.restoreState()


def _doc(buf: io.BytesIO, req: PdfRequest) -> SimpleDocTemplate:
    size = landscape(A4 if req.page_size == "a4" else letter)
    return SimpleDocTemplate(
        buf,
        pagesize=size,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=27 * mm,
        bottomMargin=14 * mm,
        title=req.title,
        author="ShotBoard",
    )


def _panel(shot: PdfShot, width: float, aspect: float, columns) -> Table:
    """One storyboard panel: picture, a caption line, notes and any custom fields."""
    img_h = width / aspect
    reader = _image(shot)
    if reader:
        picture = Image(reader, width=width, height=img_h)
    else:
        picture = Table([[""]], colWidths=[width], rowHeights=[img_h], style=[("BACKGROUND", (0, 0), (-1, -1), PANEL_BG)])
    caption = Paragraph(
        f'<font name="Helvetica-Bold" size="11">{_esc(shot.number)}</font>'
        f'&nbsp;&nbsp;<font color="#c97f0a"><b>{_esc(shot.type)}</b></font>'
        f'&nbsp;&nbsp;<font color="#6b7078">{_esc(shot.lens)} · {shot.duration:.1f}s</font>',
        STYLE_CELL,
    )
    rows = [[picture], [caption]]
    if shot.notes:
        rows.append([Paragraph(_esc(shot.notes), STYLE_NOTES)])
    extras = [f"<b>{_esc(c.label)}:</b> {_esc(shot.fields[c.id])}" for c in columns if shot.fields.get(c.id)]
    if extras:
        rows.append([Paragraph("&nbsp;&nbsp; ".join(extras), STYLE_SMALL)])
    t = Table(rows, colWidths=[width])
    t.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, 0), 0),
                ("TOPPADDING", (0, 1), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                ("BOX", (0, 0), (0, 0), 0.6, INK),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return t


def storyboard_pdf(req: PdfRequest) -> bytes:
    buf = io.BytesIO()
    doc = _doc(buf, req)
    cols = 3
    gap = 7 * mm
    width = (doc.width - gap * (cols - 1)) / cols
    custom = [c for c in req.columns if c.id not in {"thumb", "number", "type", "lens", "duration", "notes"}]
    panels = [_panel(s, width, req.aspect, custom) for s in req.shots]
    rows = [panels[i : i + cols] + [""] * (cols - len(panels[i : i + cols])) for i in range(0, len(panels), cols)]
    grid = Table(rows, colWidths=[width + (gap if i < cols - 1 else 0) for i in range(cols)])
    grid.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), gap),
                ("RIGHTPADDING", (-1, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9 * mm),
            ]
        )
    )
    deco = _Decorations(req)
    doc.build([grid], onFirstPage=deco, onLaterPages=deco)
    return buf.getvalue()


def list_pdf(req: PdfRequest) -> bytes:
    buf = io.BytesIO()
    doc = _doc(buf, req)
    thumb_w = 42 * mm
    fixed = {"thumb": thumb_w, "number": 12 * mm, "type": 16 * mm, "lens": 26 * mm, "duration": 16 * mm}
    cols = req.columns or [
        {"id": c, "label": c} for c in ("thumb", "number", "type", "lens", "duration", "notes")
    ]
    flexible = [c for c in cols if c.id not in fixed]
    remaining = doc.width - sum(fixed[c.id] for c in cols if c.id in fixed)
    # Notes gets twice the room of other free-text columns.
    weights = {c.id: (2 if c.id == "notes" else 1) for c in flexible}
    unit = remaining / max(sum(weights.values()), 1)
    widths = [fixed.get(c.id, unit * weights.get(c.id, 1)) for c in cols]

    short = {"thumb": "Frame", "number": "#", "duration": "Length"}
    header = [Paragraph(_esc(short.get(c.id, c.label)).upper(), STYLE_HEAD) for c in cols]
    # Cells have 4pt padding on each side; keep pictures inside the column.
    pic_w = thumb_w - 8
    body = []
    for s in req.shots:
        row = []
        for c in cols:
            if c.id == "thumb":
                reader = _image(s)
                if reader:
                    row.append(Image(reader, width=pic_w, height=pic_w / req.aspect))
                else:
                    row.append(Table([[""]], colWidths=[pic_w], rowHeights=[pic_w / req.aspect], style=[("BACKGROUND", (0, 0), (-1, -1), PANEL_BG)]))
            elif c.id == "number":
                row.append(Paragraph(f"<b>{_esc(s.number)}</b>", STYLE_CELL))
            elif c.id == "type":
                row.append(Paragraph(f'<font color="#c97f0a"><b>{_esc(s.type)}</b></font>', STYLE_CELL))
            elif c.id == "lens":
                row.append(Paragraph(_esc(s.lens), STYLE_CELL))
            elif c.id == "duration":
                row.append(Paragraph(f"{s.duration:.1f}s", STYLE_CELL))
            elif c.id == "notes":
                row.append(Paragraph(_esc(s.notes), STYLE_NOTES))
            else:
                row.append(Paragraph(_esc(s.fields.get(c.id, "")), STYLE_CELL))
        body.append(row)

    table = Table([header, *body], colWidths=widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK),
                ("LINEBELOW", (0, 1), (-1, -1), 0.4, RULE),
                ("TOPPADDING", (0, 1), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    deco = _Decorations(req)
    doc.build([Spacer(1, 2 * mm), table], onFirstPage=deco, onLaterPages=deco)
    return buf.getvalue()


def make_pdf(req: PdfRequest) -> bytes:
    return storyboard_pdf(req) if req.layout == "storyboard" else list_pdf(req)
