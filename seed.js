const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

mongoose.connect('mongodb://127.0.0.1:27017/billing-system')
  .then(() => console.log('MongoDB connected for seeding'))
  .catch(err => console.error(err));

(async () => {
  try {
    // Clear old users
    await User.deleteMany();

    // Create admin
    const adminPassword = await bcrypt.hash('admin123', 10);
    const staffPassword = await bcrypt.hash('staff123', 10);

    await User.create([
      {
        username: 'admin',
        password: adminPassword,
        role: 'admin'
      },
      {
        username: 'staff',
        password: staffPassword,
        role: 'staff'
      }
    ]);

    console.log('✅ Admin & Staff users created');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
