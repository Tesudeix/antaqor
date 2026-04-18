require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Product = require('../models/Product');
const SiteSettings = require('../models/SiteSettings');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/herowater';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Admin user
  const existing = await User.findOne({ email: 'admin@herowater.mn' });
  if (!existing) {
    const hash = await bcrypt.hash('herowater2024', 12);
    await User.create({ name: 'Admin', email: 'admin@herowater.mn', password: hash, role: 'admin' });
    console.log('Admin user created: admin@herowater.mn / herowater2024');
  } else {
    console.log('Admin already exists');
  }

  // Sample products
  const count = await Product.countDocuments();
  if (count === 0) {
    await Product.insertMany([
      {
        name: 'Herowater Still 500ml',
        slug: 'still-500ml',
        description: 'Цэвэр, зөөлөн амттай ундны ус. Өдөр тутмын хэрэглээнд тохиромжтой.',
        category: 'still',
        price: 1500,
        volume: '500ml',
        packSize: 1,
        stock: 1000,
        available: true,
        featured: true,
        order: 1,
      },
      {
        name: 'Herowater Still 1.5L',
        slug: 'still-1500ml',
        description: 'Гэр бүлийн хэрэглээнд тохиромжтой том хэмжээ.',
        category: 'still',
        price: 2500,
        volume: '1.5L',
        packSize: 1,
        stock: 500,
        available: true,
        featured: true,
        order: 2,
      },
      {
        name: 'Herowater Sparkling 330ml',
        slug: 'sparkling-330ml',
        description: 'Нарийн хийтэй, сэргээх чадвартай бүлээн ус.',
        category: 'sparkling',
        price: 2000,
        volume: '330ml',
        packSize: 1,
        stock: 300,
        available: true,
        featured: true,
        order: 3,
      },
      {
        name: 'Herowater Alkaline 500ml',
        slug: 'alkaline-500ml',
        description: 'pH 9.5 шүлтлэг ус. Эрүүл мэндэд тустай.',
        category: 'alkaline',
        price: 3000,
        volume: '500ml',
        packSize: 1,
        stock: 200,
        available: true,
        featured: false,
        order: 4,
      },
      {
        name: 'Herowater Bulk 19L',
        slug: 'bulk-19l',
        description: 'Оффис, гэр бүлийн том хэрэглээнд. Диспенсертэй.',
        category: 'bulk',
        price: 8000,
        volume: '19L',
        packSize: 1,
        stock: 100,
        available: true,
        featured: false,
        order: 5,
      },
      {
        name: 'Herowater Still 6-Pack',
        slug: 'still-500ml-6pack',
        description: '500ml x 6 ширхэг. Хэмнэлттэй багц.',
        category: 'still',
        price: 7500,
        volume: '500ml',
        packSize: 6,
        stock: 200,
        available: true,
        featured: false,
        order: 6,
      },
    ]);
    console.log('Sample products created');
  }

  // Site settings
  const settings = await SiteSettings.findOne();
  if (!settings) {
    await SiteSettings.create({
      heroSections: [
        { title: 'HEROWATER', subtitle: 'Цэвэр. Премиум. Усны шинэ стандарт.', ctaText: 'Захиалах', ctaLink: '/products.html', order: 0, active: true },
        { title: 'Байгалийн цэвэр эх үүсвэр', subtitle: 'Монгол нутгийн гүний булгийн ус', ctaText: 'Дэлгэрэнгүй', ctaLink: '/about.html', order: 1, active: true },
      ],
      contactPhone: '+976 9999 0000',
      contactEmail: 'info@herowater.mn',
    });
    console.log('Site settings created');
  }

  await mongoose.disconnect();
  console.log('Done');
}

seed().catch(err => { console.error(err); process.exit(1); });
