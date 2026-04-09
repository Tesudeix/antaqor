require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');
const Drink = require('../models/Drink');
const User = require('../models/User');
const SiteSettings = require('../models/SiteSettings');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/joybilliard';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create default site settings if not exists
    const existingSettings = await SiteSettings.findOne();
    if (!existingSettings) {
      await SiteSettings.create({});
      console.log('Created default site settings');
    }

    // Create admin user
    const existingAdmin = await User.findOne({ name: { $regex: /^admin$/i } });
    if (existingAdmin) {
      // Update password
      existingAdmin.password = 'admin1234';
      existingAdmin.role = 'admin';
      existingAdmin.email = 'admin@joybilliard.mn';
      await existingAdmin.save();
      console.log('Updated admin user: admin / admin1234');
    } else {
      await User.create({
        name: 'admin',
        email: 'admin@joybilliard.mn',
        phone: '+976 9911 2233',
        password: 'admin1234',
        role: 'admin'
      });
      console.log('Created admin user: admin / admin1234');
    }

    console.log('Seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
}

seed();
