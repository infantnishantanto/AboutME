require('dotenv').config();
const express = require('express')
const path = require('path')
const mongoose = require('mongoose')
const { check, validationResult } = require('express-validator')
var session = require('express-session');
const fileupload = require('express-fileupload');

var app = express();

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

const User = mongoose.model('user', {
    userName: String,
    pass: String
});

const Content = mongoose.model('content', {
    slug: String,
    imPath: String,
    content: String
});

// mongoose.connect("mongodb://localhost:27017/Infant");
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Atlas connected"))
.catch(err => console.error("❌ Connection error:", err));

app.get('/', (req, res) => {
    Content.find({}).then((data) => {
        res.redirect('/page/1');

        

    }).catch((err) => {
        console.log(err);

    });
});



app.get('/login', (req, res) => {
    res.render('login')
});

app.post("/login", [
    check('uname', "Usename Can not be empty").notEmpty(),
    check('passwd', "Password Can not be empty").notEmpty(),
], (req, res) => {
    console.log("Login Attempt:", req.body.uname, req.body.passwd);
    var errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.render('login', { formErrors: errors.array() });
    } else {
        User.findOne({ userName: req.body.uname }).then((data) => {

            if (data != null) {
                if (data.pass == req.body.passwd) {

                    req.session.logUser = data.userName;
                    req.session.logStatus = true;
                    res.redirect('/welcome/login');
                } else {
                    var authErrors = [{ "msg": "Password Wrong" }];
                    res.render('login', { authErrors: authErrors });
                }
            } else {
                var authErrors = [{ "msg": "UserName or Password Wrong" }];
                res.render('login', { authErrors: authErrors });
            }

        }).catch((err) => {
            console.log(err);
        })
    }

});

app.get('/welcome/:qobj', (req, res) => {
    if (req.session.logStatus) {
        res.render('welcome', { logName: req.session.logUser, loggedIn: true, message: req.params.qobj });
    }
    else {
        res.redirect('/');
    }
});

app.get('/add', (req, res) => {
    if (req.session.logStatus) {
        res.render('add', { logName: req.session.logUser });
    } else {
        res.redirect('welcome');
    }
});


app.post('/add', [
    check('slug', "Slug Can not be empty").notEmpty(),
    check('tar', "Content Can not be empty").notEmpty()
], (req, res) => {

    if (req.session.logStatus) {
        var errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.render('add', { logName: req.session.logUser, errors: errors.array() });
        }

        var pathStore;

        if (req.files) {
            var imName = req.files.imFile.name;
            var im = req.files.imFile;
            var path = 'public/uploads/' + imName;

            im.mv(path, (err) => {
                if (err) {
                    console.log(err);
                }
            })
            pathStore = '/uploads/' + imName;
        }



        var newContent = new Content({
            slug: req.body.slug,
            imPath: pathStore,
            content: req.body.tar
        });

        newContent.save().then((data) => {
            res.redirect('/welcome/Added Successfully');
        }).catch((err) => {
            console.log(err);
        })


    } else {
        res.redirect('welcome');
    }

});

app.get('/edit', (req, res) => {
    if (req.session.logStatus) {
        Content.find({}).then((data) => {
            res.render('edit', { logName: req.session.logUser, data: data });
        }).catch((err) => {
            console.log(err)
        })
    } else {
        res.redirect('/welcome/login');
    }
})

app.get('/delete/:ids&:type', (req, res) => {


    Content.findOneAndDelete({ _id: req.params.ids }).then((data) => {
        if (data != null) {
            res.redirect('/edit')
        } else {
            Console.log("Could  not find record");
        }

    })
})

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/update/:id', (req, res) => {

    if (req.session.logStatus) {

        Content.findOne({ _id: req.params.id }).then((data) => {

            res.render('update', { data: data, loggedIn: true, logName: req.session.logUser });

        }).catch((err) => {
            console.log(err);
        })
    }

});

app.post('/update', [
    check('slug', "Slug Can not be empty").notEmpty(),
    check('tar', "Content Can not be empty").notEmpty()
], (req, res) => {
    console.log("Updating")
    if (req.session.logStatus) {
        var errors = validationResult(req);
        if (!errors.isEmpty()) {
            Content.findOne({ _id: req.body.cMongoId }).then((data) => {
                res.render('update', { data: data, errors: errors.array(), loggedIn: true, logName: req.session.logUser })

            }).catch((err) => {
                console.log(err);
            })
        } else {
            var storePath = req.body.cOldPath;
            if (req.files) {
                var imName = req.files.imFile.name;
                var im = req.files.imFile;
                var path = 'public/uploads/' + imName;

                if (req.body.cOldPath != 'uploads/' + imName) {
                    storePath = '/uploads/' + imName;
                    im.mv(path).then(() => {

                        console.log("New Image Upload Successful");
                    }).catch((err) => {
                        console.log(err);
                    })
                }

            }
            Content.findOne({ _id: req.body.cMongoId }).then((data) => {
                console.log(data);

                data.slug = req.body.slug;
                data.imPath = storePath;
                data.content = req.body.tar;

                data.save().then((data) => {
                    
                    res.redirect('/welcome/Edited Successfully',)
                }).catch((err) => {
                    console.log(err);
                })
            })

        }
    }

})


app.get('/page/:id', (req, res) => {

   

    Content.find({}).then((data) => {
        var page = data[0];
        for (item of data) {
            if (item._id == req.params.id) {
                page = item
            }
        }

        res.render('home', { logName: req.session.logUser, data: data, page: page });

    }).catch((err) => {
        console.log(err);

    });

})



app.listen(8080);
console.log("Server Running...");




