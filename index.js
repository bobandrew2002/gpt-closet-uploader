require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(express.json());

// 📸 Endpoint: Add clothing item
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const { originalname, path: tempPath } = req.file;
    const { name, type, material, fit, wears_before_laundry, is_outerwear } = req.body;

    const fileExt = path.extname(originalname);
    const fileName = `${Date.now()}${fileExt}`;
    const fileBuffer = fs.readFileSync(tempPath);

    // 🧺 Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('clothing-images')
      .upload(fileName, fileBuffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // 🌐 Get public URL
    const { data: publicURL } = supabase
      .storage
      .from('clothing-images')
      .getPublicUrl(fileName);

    // 🧠 Insert into your clothing_items table
    const { data, error } = await supabase
      .from('clothing_items')
      .insert([{
        name,
        type,
        material,
        fit,
        wears_before_laundry: parseInt(wears_before_laundry),
        wear_count: 0,
        available: true,
        is_outerwear: is_outerwear === 'true',
        image_url: publicURL.publicUrl,
        last_worn: null
      }]);

    if (error) throw error;

    res.status(200).json({ message: 'Clothing item uploaded!', data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.listen(3000, () => {
  console.log('👟 GPT Wardrobe Uploader is running on http://localhost:3000');
});
