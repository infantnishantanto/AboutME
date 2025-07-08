require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const { check, validationResult } = require('express-validator');
const session = require('express-session');
const fileupload = require('express-fileupload');

const app = express();

app.use(express.urlencoded({ extended: false }));
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.use('/tinymce', express.static(path.join(__dirname, 'node_modules', 'tinymce')));
app.use(fileupload());

app.use(session({
    secret: 'mysecret',
    resave: false,
    saveUninitialized: true
}));

// Mongoose Models
const User = mongoose.model('user', {
    userName: String,
    pass: String
});

const Content = mongoose.model('content', {
    slug: String,
    image: {
        data: Buffer,
        contentType: String
    },
    content: String
});

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Atlas connected"))
.catch(err => console.error("❌ Connection error:", err));

// Routes
app.get('/', (req, res) => {
    Content.find({}).then(() => {
        res.redirect('/page/1');
    }).catch(err => console.log(err));
});

app.get('/login', (req, res) => res.render('login'));

app.post("/login", [
    check('uname', "Username cannot be empty").notEmpty(),
    check('passwd', "Password cannot be empty").notEmpty()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.render('login', { formErrors: errors.array() });

    User.findOne({ userName: req.body.uname }).then(user => {
        if (user && user.pass === req.body.passwd) {
            req.session.logUser = user.userName;
            req.session.logStatus = true;
            res.redirect('/welcome/login');
        } else {
            res.render('login', { authErrors: [{ msg: "Username or Password incorrect" }] });
        }
    }).catch(err => console.log(err));
});

app.get('/welcome/:msg', (req, res) => {
    if (req.session.logStatus) {
        res.render('welcome', { logName: req.session.logUser, loggedIn: true, message: req.params.msg });
    } else {
        res.redirect('/');
    }
});

app.get('/add', (req, res) => {
    if (req.session.logStatus) {
        res.render('add', { logName: req.session.logUser });
    } else {
        res.redirect('/welcome/login');
    }
});

app.post('/add', [
    check('slug', "Slug cannot be empty").notEmpty(),
    check('tar', "Content cannot be empty").notEmpty()
], (req, res) => {
    if (!req.session.logStatus) return res.redirect('/welcome/login');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('add', { logName: req.session.logUser, errors: errors.array() });
    }

    let newContent;
    if (req.files && req.files.imFile) {
        const im = req.files.imFile;
        newContent = new Content({
            slug: req.body.slug,
            image: {
                data: im.data,
                contentType: im.mimetype
            },
            content: req.body.tar
        });
    } else {
        newContent = new Content({
            slug: req.body.slug,
            content: req.body.tar
        });
    }

    newContent.save().then(() => {
        res.redirect('/welcome/Added Successfully');
    }).catch(err => console.log(err));
});

app.get('/edit', (req, res) => {
    if (!req.session.logStatus) return res.redirect('/welcome/login');

    Content.find({}).then(data => {
        res.render('edit', { logName: req.session.logUser, data });
    }).catch(err => console.log(err));
});

app.get('/delete/:id', (req, res) => {
    Content.findByIdAndDelete(req.params.id).then(() => {
        res.redirect('/edit');
    }).catch(err => console.log(err));
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/update/:id', (req, res) => {
    if (!req.session.logStatus) return res.redirect('/welcome/login');

    Content.findById(req.params.id).then(data => {
        res.render('update', { data, loggedIn: true, logName: req.session.logUser });
    }).catch(err => console.log(err));
});

app.post('/update', [
    check('slug', "Slug cannot be empty").notEmpty(),
    check('tar', "Content cannot be empty").notEmpty()
], (req, res) => {
    if (!req.session.logStatus) return res.redirect('/welcome/login');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        Content.findById(req.body.cMongoId).then(data => {
            res.render('update', { data, errors: errors.array(), loggedIn: true, logName: req.session.logUser });
        });
    } else {
        Content.findById(req.body.cMongoId).then(data => {
            data.slug = req.body.slug;
            data.content = req.body.tar;

            if (req.files && req.files.imFile) {
                const im = req.files.imFile;
                data.image = {
                    data: im.data,
                    contentType: im.mimetype
                };
            }

            data.save().then(() => {
                res.redirect('/welcome/Edited Successfully');
            }).catch(err => console.log(err));
        });
    }
});

app.get('/page/:id', (req, res) => {
    Content.find({}).then(data => {
        let page = data.find(p => p._id.toString() === req.params.id) || data[0];
        res.render('home', { logName: req.session.logUser, data, page });
    }).catch(err => console.log(err));
});

// Serve image from MongoDB
app.get('/image/:id', (req, res) => {
    Content.findById(req.params.id).then(data => {
        if (data && data.image && data.image.data) {
            res.contentType(data.image.contentType);
            res.send(data.image.data);
        } else {
            res.status(404).send('Image not found');
        }
    }).catch(err => {
        console.error(err);
        res.status(500).send('Error loading image');
    });
});

// Start server
app.listen(8080, () => console.log("✅ Server Running on http://localhost:8080"));
