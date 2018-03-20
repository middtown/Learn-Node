const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const multer = require('multer'); //image uploads
const jimp = require('jimp');
const uuid = require('uuid');

//phot upload
const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter: function (req, file, next) {
      const isPhoto = file.mimetype.startsWith('image/');
      if (isPhoto) {
        next(null, true);
      } else {
        next({ message: 'That filetype isn\'t allowed!' }, false);
      }
    },
};

exports.homePage = (req, res) => {
  res.render('index');
};

exports.addStore = (req, res) => {
  res.render('editStore', { title: 'Add Store' });
};

//temperalily stores images to memory then to the database
exports.upload = multer(multerOptions).single('photo');

//resize images
exports.resize = async (req, res, next) => {

  //check if there is no new file to resize
  if (!req.file) {
    next();//skip to next middleware
    return;
  }

  const extension = req.file.mimetype.split('/')[1];
  req.body.photo = `${uuid.v4()}.${extension}`;

  //resize
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);

  //once photo is written to filesystem, keep going
  next();

};

exports.createStore = async (req, res) => {

  //create a author for each store created
  req.body.author = req.user._id;

  //await needs to be wrapped in a try-catch web, however, we use a function
  //handeling we built in the handlers/errorHandlers file imported into index.js
  const store = await (new Store(req.body)).save();
  req.flash('success', `Successfully created ${store.name}. Care to leave a review`);
  res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {

  //query database for list of all Stores
  const stores = await Store.find();
  res.render('stores', { title: 'Stores', stores }); //es6 passing of variable stores
};

//confirm owner
const confirmOwner = (store, user) => {
  if (!store.author.equals(user._id)) {
    throw Error('You must own this store to edit it.');
  }
};

//edit store
exports.editStore = async (req, res) => {

  //find store given the id
  const store = await Store.findOne({ _id: req.params.id });

  //confirm they are the owner of stores
  confirmOwner(store, req.user);

  //render out editform so the user can update thier store
  res.render('editStore', { title: `Edit ${store.name}`, store });
};

exports.updateStore = async (req, res) => {

  //set location data to be a point
  req.body.location.type = 'Point';

  //find store and update given the id and send message to user upon completion
  const store = await Store.findOneAndUpdate({
    _id: req.params.id, }, req.body, { new: true, runValidators: true }).exec();
  req.flash('success', `Successfully updated <strong>${store.name}</strong>.
  <a href='/stores/${store.slug}'>View Store</a>`);
  res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res) => {
  const store = await Store.findOne({ slug: req.params.slug }).populate('author');
  if (!store) return next();
  res.render('store', { store, title: store.name });
};

exports.getStoreByTag = async (req, res) => {
  const tag = req.params.tag;
  const tagQuery = tag || { $exists: true };
  const tagsPromise = Store.getTagsList();
  const storesPromise = Store.find({ tags: tagQuery });
  const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);

  res.render('tag', { tags, title: 'Tags', tag, stores });
};
