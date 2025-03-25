const { createClient } = require('@supabase/supabase-js');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send({ message: 'Only POST allowed' });
  }

  const form = new formidable.IncomingForm({ multiples: false, uploadDir: '/tmp', keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Form parsing failed' });
    }

    try {
      const { name, type, material, fit, wears_before_laundry, is_outerwear } = fields;
      const imageFile = files.image;

      const fileExt = path.extname(imageFile.originalFilename || '.jpg');
      const fileName = `${Date.now()}${fileExt}`;
      const fileBuffer = fs.readFileSync(imageFile.filepath);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('clothing-images')
        .upload(fileName, fileBuffer, {
          contentType: imageFile.mimetype,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicURL } = supabase
        .storage
        .from('clothing-images')
        .getPublicUrl(fileName);

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

      return res.status(200).json({ message: 'Clothing item uploaded!', data });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  });
}
