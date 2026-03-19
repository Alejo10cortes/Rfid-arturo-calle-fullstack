import { PrismaClient, UserRole, ReaderStatus, TagStatus, AlertType, AlertSeverity } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── USERS ──────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@1234', 12);
  const opHash    = await bcrypt.hash('Operator@1234', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@arturocalle.com' },
    update: {},
    create: {
      email: 'admin@arturocalle.com',
      passwordHash: adminHash,
      name: 'Administrador Sistema',
      role: UserRole.ADMIN,
    },
  });

  const operator = await prisma.user.upsert({
    where: { email: 'operador@arturocalle.com' },
    update: {},
    create: {
      email: 'operador@arturocalle.com',
      passwordHash: opHash,
      name: 'Operador Almacén',
      role: UserRole.OPERATOR,
    },
  });

  console.log(`✅ Users: ${admin.email}, ${operator.email}`);

  // ── READERS ────────────────────────────────────────────────────────────────
  const readerData = [
    { name: 'Reader-A1', ipAddress: '192.168.1.101', port: 5084, zone: 'Zone A', location: 'Zona A — Entrada', model: 'Impinj R700', status: ReaderStatus.ONLINE },
    { name: 'Reader-A2', ipAddress: '192.168.1.102', port: 5084, zone: 'Zone A', location: 'Zona A — Centro',  model: 'Impinj R700', status: ReaderStatus.ONLINE },
    { name: 'Reader-B1', ipAddress: '192.168.1.103', port: 5084, zone: 'Zone B', location: 'Zona B — Entrada', model: 'Impinj R700', status: ReaderStatus.ONLINE },
    { name: 'Reader-B2', ipAddress: '192.168.1.104', port: 5084, zone: 'Zone B', location: 'Zona B — Salida',  model: 'Zebra FX9600', status: ReaderStatus.OFFLINE },
    { name: 'Reader-C1', ipAddress: '192.168.1.105', port: 5084, zone: 'Zone C', location: 'Zona C — Principal', model: 'Impinj R700', status: ReaderStatus.ONLINE },
    { name: 'Reader-C2', ipAddress: '192.168.1.106', port: 5084, zone: 'Zone C', location: 'Zona C — Almacén', model: 'Zebra FX9600', status: ReaderStatus.ERROR },
    { name: 'Reader-D1', ipAddress: '192.168.1.107', port: 5084, zone: 'Zone D', location: 'Zona D — Cargue',  model: 'Impinj R700', status: ReaderStatus.ONLINE },
    { name: 'Reader-D2', ipAddress: '192.168.1.108', port: 5084, zone: 'Zone D', location: 'Zona D — Muelle',  model: 'Zebra FX9600', status: ReaderStatus.ONLINE },
  ];

  const readers = await Promise.all(
    readerData.map(r => prisma.reader.upsert({
      where: { name: r.name },
      update: {},
      create: { ...r, frequencyMin: 860000, frequencyMax: 960000, txPower: 30, rxSensitivity: -70 },
    }))
  );
  console.log(`✅ Readers: ${readers.length} created`);

  // ── PRODUCTS ───────────────────────────────────────────────────────────────
  const productData = [
    { sku: 'AC-JK-2024-001', name: 'Blazer Navy Clásico',     category: 'Sacos',    color: 'Navy',        size: 'L',  price: 459000 },
    { sku: 'AC-JK-2024-002', name: 'Blazer Gris Oxford',      category: 'Sacos',    color: 'Gris',        size: 'M',  price: 459000 },
    { sku: 'AC-PN-2024-001', name: 'Pantalón Formal Carbón',  category: 'Pantalones', color: 'Carbón',    size: 'M',  price: 189000 },
    { sku: 'AC-PN-2024-002', name: 'Chino Slim Fit Khaki',    category: 'Pantalones', color: 'Khaki',     size: 'M',  price: 169000 },
    { sku: 'AC-SH-2024-001', name: 'Camisa Oxford Blanca',    category: 'Camisas',  color: 'Blanco',      size: 'XL', price: 129000 },
    { sku: 'AC-SH-2024-002', name: 'Camisa Ejecutiva Azul',   category: 'Camisas',  color: 'Azul Claro',  size: 'L',  price: 129000 },
    { sku: 'AC-TI-2024-001', name: 'Corbata Seda Burgundy',   category: 'Corbatas', color: 'Burgundy',    size: 'U',  price: 89000  },
    { sku: 'AC-SU-2024-001', name: 'Traje Completo Gris',     category: 'Trajes',   color: 'Gris Medio',  size: 'L',  price: 899000 },
  ];

  const products = await Promise.all(
    productData.map(p => prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: { ...p, price: p.price, brand: 'Arturo Calle' },
    }))
  );
  console.log(`✅ Products: ${products.length} created`);

  // ── RFID TAGS ──────────────────────────────────────────────────────────────
  const zones = ['Zone A', 'Zone B', 'Zone C', 'Zone D'];
  const tagData: Array<{ epc: string; productId: string; zone: string; rssi: number }> = [];

  products.forEach((product, pi) => {
    const count = [24, 12, 8, 0, 15, 19, 6, 5][pi] || 10;
    for (let i = 0; i < count; i++) {
      const hex = (pi * 1000 + i).toString(16).toUpperCase().padStart(8, '0');
      tagData.push({
        epc: `E200${hex}${Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(8, '0')}`,
        productId: product.id,
        zone: zones[i % zones.length],
        rssi: -(Math.floor(Math.random() * 30) + 50),
      });
    }
  });

  let tagCount = 0;
  for (const t of tagData) {
    await prisma.rFIDTag.upsert({
      where: { epc: t.epc },
      update: {},
      create: {
        epc: t.epc,
        productId: t.productId,
        currentZone: t.zone,
        lastRssi: t.rssi,
        status: TagStatus.ACTIVE,
        lastSeenAt: new Date(),
      },
    });
    tagCount++;
  }
  console.log(`✅ RFID Tags: ${tagCount} created`);

  // ── ALERTS ─────────────────────────────────────────────────────────────────
  await prisma.alert.createMany({
    data: [
      {
        type: AlertType.READER_OFFLINE,
        severity: AlertSeverity.ERROR,
        title: 'Lector desconectado',
        message: 'Reader-B2 sin respuesta por más de 5 minutos',
        readerId: readers[3].id,
        zone: 'Zone B',
      },
      {
        type: AlertType.LOW_STOCK,
        severity: AlertSeverity.WARNING,
        title: 'Stock bajo',
        message: 'AC-PN-2024-001 — Solo 8 unidades disponibles en Zone B',
        zone: 'Zone B',
      },
      {
        type: AlertType.READER_ERROR,
        severity: AlertSeverity.CRITICAL,
        title: 'Error en lector',
        message: 'Reader-C2 reporta error de firmware v2.3.8. Actualización requerida.',
        readerId: readers[5].id,
        zone: 'Zone C',
      },
    ],
  });

  console.log('✅ Alerts seeded');
  console.log('\n🎉 Seed completo!\n');
  console.log('Credenciales:');
  console.log('  Admin    → admin@arturocalle.com     / Admin@1234');
  console.log('  Operator → operador@arturocalle.com / Operator@1234');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
