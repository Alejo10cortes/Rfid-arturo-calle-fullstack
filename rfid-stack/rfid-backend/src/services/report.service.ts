// src/services/report.service.ts
import fs from 'fs';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import PDFDocument from 'pdfkit';
import prisma from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { ReportFilters } from '../types';

class ReportService {
  private ensureDir(): void {
    if (!fs.existsSync(env.REPORTS_OUTPUT_DIR)) {
      fs.mkdirSync(env.REPORTS_OUTPUT_DIR, { recursive: true });
    }
  }

  // ── SCAN EVENTS REPORT ─────────────────────────────────────────────────────

  async generateScanReport(filters: ReportFilters): Promise<string> {
    this.ensureDir();

    const where: Record<string, unknown> = {};
    if (filters.startDate)  where['createdAt'] = { gte: filters.startDate };
    if (filters.endDate)    where['createdAt'] = { ...(where['createdAt'] as object || {}), lte: filters.endDate };
    if (filters.zone)       where['zone']      = filters.zone;
    if (filters.readerId)   where['readerId']  = filters.readerId;

    const events = await prisma.scanEvent.findMany({
      where,
      take: 10000,
      orderBy: { createdAt: 'desc' },
      include: {
        reader: { select: { name: true, zone: true } },
        tag:    { include: { product: { select: { sku: true, name: true, category: true } } } },
      },
    });

    const ts = Date.now();

    if (filters.format === 'csv') {
      return this._csvScanReport(events, ts);
    } else {
      return this._pdfScanReport(events, ts, filters);
    }
  }

  private async _csvScanReport(events: any[], ts: number): Promise<string> {
    const filePath = path.join(env.REPORTS_OUTPUT_DIR, `scan_report_${ts}.csv`);

    const writer = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'epc',       title: 'EPC' },
        { id: 'sku',       title: 'SKU' },
        { id: 'product',   title: 'Producto' },
        { id: 'reader',    title: 'Lectora' },
        { id: 'zone',      title: 'Zona' },
        { id: 'antenna',   title: 'Antena' },
        { id: 'rssi',      title: 'RSSI (dBm)' },
        { id: 'frequency', title: 'Frecuencia (kHz)' },
      ],
    });

    await writer.writeRecords(
      events.map(e => ({
        timestamp: e.createdAt.toISOString(),
        epc:       e.epc,
        sku:       e.tag?.product?.sku   || 'N/A',
        product:   e.tag?.product?.name  || 'N/A',
        reader:    e.reader?.name        || e.readerId,
        zone:      e.zone,
        antenna:   e.antennaId,
        rssi:      e.rssi,
        frequency: e.frequency           || 'N/A',
      }))
    );

    logger.info(`[Report] CSV generated: ${filePath}`);
    return filePath;
  }

  private async _pdfScanReport(events: any[], ts: number, filters: ReportFilters): Promise<string> {
    const filePath = path.join(env.REPORTS_OUTPUT_DIR, `scan_report_${ts}.pdf`);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // ── Header ──
      doc.font('Helvetica-Bold').fontSize(18).text('Arturo Calle — Reporte de Escaneos RFID', { align: 'center' });
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10)
        .text(`Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' })
        .text(`Total eventos: ${events.length}`, { align: 'center' });

      if (filters.startDate || filters.endDate) {
        doc.text(`Período: ${filters.startDate?.toLocaleDateString('es-CO') || '—'} al ${filters.endDate?.toLocaleDateString('es-CO') || 'hoy'}`, { align: 'center' });
      }
      if (filters.zone) doc.text(`Zona: ${filters.zone}`, { align: 'center' });

      doc.moveDown(1);

      // ── Tabla ──
      const colWidths = [90, 100, 90, 70, 55, 55, 55];
      const headers   = ['Timestamp', 'EPC', 'SKU', 'Lectora', 'Zona', 'RSSI', 'Antena'];
      const startX    = 40;
      let   y         = doc.y;

      // Header row
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      doc.rect(startX, y, colWidths.reduce((a,b) => a+b, 0), 16).fill('#0a1a2f');
      let x = startX;
      headers.forEach((h, i) => {
        doc.fillColor('#ffffff').text(h, x + 3, y + 4, { width: colWidths[i] - 3, lineBreak: false });
        x += colWidths[i];
      });
      y += 16;

      doc.font('Helvetica').fontSize(7).fillColor('#000000');

      events.slice(0, 500).forEach((e, idx) => { // máx 500 en PDF
        if (y > 760) {
          doc.addPage();
          y = 40;
        }
        const bg = idx % 2 === 0 ? '#f5f5f5' : '#ffffff';
        doc.rect(startX, y, colWidths.reduce((a,b) => a+b, 0), 14).fill(bg);

        const row = [
          new Date(e.createdAt).toLocaleString('es-CO'),
          e.epc.slice(0, 16) + '...',
          e.tag?.product?.sku || 'N/A',
          e.reader?.name || e.readerId.slice(0, 8),
          e.zone,
          `${e.rssi} dBm`,
          `A${e.antennaId}`,
        ];

        x = startX;
        doc.fillColor('#000000');
        row.forEach((cell, i) => {
          doc.text(String(cell), x + 3, y + 3, { width: colWidths[i] - 3, lineBreak: false });
          x += colWidths[i];
        });
        y += 14;
      });

      if (events.length > 500) {
        doc.moveDown().font('Helvetica').fontSize(9).fillColor('#888888')
          .text(`... y ${events.length - 500} eventos más. Descarga el CSV para el reporte completo.`, startX);
      }

      // ── Footer ──
      doc.fontSize(8).fillColor('#888888').text(
        'Arturo Calle — Sistema RFID | Confidencial',
        40, doc.page.height - 40, { align: 'center' }
      );

      doc.end();
      stream.on('finish', () => { logger.info(`[Report] PDF generated: ${filePath}`); resolve(filePath); });
      stream.on('error', reject);
    });
  }

  // ── INVENTORY REPORT ───────────────────────────────────────────────────────

  async generateInventoryReport(format: 'csv' | 'pdf'): Promise<string> {
    this.ensureDir();
    const ts = Date.now();

    const products = await prisma.product.findMany({
      include: {
        rfidTags: {
          where: { status: 'ACTIVE' },
          select: { currentZone: true, lastRssi: true },
        },
      },
      orderBy: { sku: 'asc' },
    });

    const rows = products.map(p => ({
      sku:      p.sku,
      name:     p.name,
      category: p.category || 'N/A',
      color:    p.color    || 'N/A',
      size:     p.size     || 'N/A',
      stock:    p.rfidTags.length,
      zones:    [...new Set(p.rfidTags.map(t => t.currentZone).filter(Boolean))].join(', ') || 'N/A',
      avgRssi:  p.rfidTags.length
                  ? Math.round(p.rfidTags.reduce((s,t) => s + (t.lastRssi || 0), 0) / p.rfidTags.length)
                  : 'N/A',
    }));

    if (format === 'csv') {
      const filePath = path.join(env.REPORTS_OUTPUT_DIR, `inventory_${ts}.csv`);
      const writer = createObjectCsvWriter({
        path: filePath,
        header: [
          { id: 'sku', title: 'SKU' }, { id: 'name', title: 'Nombre' },
          { id: 'category', title: 'Categoría' }, { id: 'color', title: 'Color' },
          { id: 'size', title: 'Talla' }, { id: 'stock', title: 'Stock (tags activos)' },
          { id: 'zones', title: 'Zonas' }, { id: 'avgRssi', title: 'RSSI Prom (dBm)' },
        ],
      });
      await writer.writeRecords(rows);
      return filePath;
    }

    // PDF básico de inventario
    const filePath = path.join(env.REPORTS_OUTPUT_DIR, `inventory_${ts}.pdf`);
    return new Promise((resolve, reject) => {
      const doc    = new PDFDocument({ margin: 40 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc.font('Helvetica-Bold').fontSize(18).text('Arturo Calle — Reporte de Inventario RFID', { align: 'center' });
      doc.font('Helvetica').fontSize(10).text(`Generado: ${new Date().toLocaleString('es-CO')}  |  ${rows.length} productos`, { align: 'center' });
      doc.moveDown();

      const total = rows.reduce((s, r) => s + r.stock, 0);
      doc.fontSize(11).text(`Total unidades en sistema: ${total}`).moveDown();

      rows.forEach((r, i) => {
        if (doc.y > 720) doc.addPage();
        const bg = i % 2 === 0 ? '#f9f9f9' : '#ffffff';
        doc.rect(40, doc.y, 515, 18).fill(bg);
        doc.fillColor('#000').fontSize(8)
          .text(`${r.sku} — ${r.name}`, 43, doc.y - 14, { width: 280, lineBreak: false })
          .text(`Stock: ${r.stock}`, 330, doc.y - 14, { width: 80, lineBreak: false })
          .text(`Zonas: ${r.zones}`, 415, doc.y - 14, { width: 140, lineBreak: false });
        doc.moveDown(0.3);
      });

      doc.end();
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    });
  }

  cleanOldReports(olderThanHours = 24): void {
    const cutoff = Date.now() - olderThanHours * 3600 * 1000;
    try {
      fs.readdirSync(env.REPORTS_OUTPUT_DIR).forEach(f => {
        const fp = path.join(env.REPORTS_OUTPUT_DIR, f);
        if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
      });
    } catch {}
  }
}

export const reportService = new ReportService();
