const path = require('path');
const http = require('http')
const express = require('express');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages')
const bodyParser = require('body-parser');
const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require('./utils/users')


var mongoose = require('mongoose');
const { stringify } = require('querystring');
const uri = "mongodb+srv://aditi256:aditiaditi@cluster0.lomtc.mongodb.net/myFirstDatabase?retryWrites=true&w=majority"
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
var jwt = require('jsonwebtoken');
var cookieParser = require('cookie-parser');
const jwtSecret="key"; // use to make JWT token



const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));
app.use(bodyParser.urlencoded({ extended: true }));
const server = http.createServer(app);
const io = socketio(server);
//set static folder

app.use(cookieParser());


const userSchema = {
    username: String,
    password: String
}
const user = mongoose.model("user", userSchema);
app.get("/register", (req, res) => {
    res.render('register');
})
app.post("/register", async (req, res) => {
    // check if email already exitst
    var oldUser = await user.find({ username: req.body.username });
    if (oldUser.length) {
        console.log('user found');
        res.redirect("/login");
        return;
    }
    var newUser = new user({
        username: req.body.username,
        password: req.body.password
    })
    console.log(req.body.username)
    newUser.save();
    res.redirect("/login");
}) // cuz after post we should redirect
app.get("/login", (req, res) => {
    res.render("login");
})
//login
app.post("/login",async (req,res)=>{
    var old = await user.find({ username: req.body.username, password:req.body.password });
    let oldUser=old[0];
   //if user not found then redirect  to register page
   
console.log(oldUser)
    if(!oldUser){
        res.redirect("/register");
        return;
    }
    // now using JWT token
    var token=generateToken(oldUser);
    console.log(token)
    res.cookie("auth",token);
    res.redirect("/");
})
// logout
app.post("/logout",(req,res)=>{
    res.clearCookie("auth");
    res.redirect("/login");
})
  function generateToken(oldUser){
      let data ={
          username:oldUser.username,
          password:oldUser.password
      }
      let token=   jwt.sign(data,jwtSecret) //generates token
      return token;
}


app.use((req, res, next) => {
    
    if (!req.cookies.auth) {
        res.redirect('/login');
    }
    else {
        var token=req.cookies.auth;
        
      jwt.verify(token,jwtSecret,(err)=>{
           if(err){
            res.clearCookie("auth");
            res.redirect("/login");
          
           }
           else{
               next();
           }
       })
          
    }
}
)

 

app.use(express.static(path.join(__dirname, 'public')))
const bot = "Chat Bot"
//Run when client connects
io.on('connection', socket => {
    //console.log("hii")
    socket.on('joinRoom', ({ username, room }) => {
        const user = userJoin(socket.id, username, room);
        socket.join(user.room);

        // Welcome current user
        socket.emit('message', formatMessage(bot, 'Welcome to chatChord!')); // this will emit to single client
        //io.emit - this will emit to all the clients in general

        // Broadcast when a user connects
        socket.broadcast.to(user.room).emit('message', formatMessage(bot, `${user.username} has joined`)); // This will emit to everybody except the user that is connecting

        //Send users and room info
        io.to(user.room).emit('roomUsers', {
            room: user.room,
            users: getRoomUsers(user.room)
        });

    });


    // Listen for chatMessage; Taking Messages from user
    socket.on('chatMessage', msg => {
        const user = getCurrentUser(socket.id);
        io.to(user.room).emit('message', formatMessage(user.username, msg));
    })

    //Runs when client disconnects
    socket.on('disconnect', () => {
        const user = userLeave(socket.id);

        if (user) {
            io.to(user.room).emit('message', formatMessage(bot, ` ${user.username} has left the chat`));

            //Send users and room info
            io.to(user.room).emit('roomUsers', {
                room: user.room,
                users: getRoomUsers(user.room)
            });
        }


    })
});




server.listen(3000, () => {
    console.log("Server is listening on port 3000");
});


