if (process.env.NODE_ENV != "production") {
    require('dotenv').config()
}


let express = require("express");
let app = express();

const mongoose = require('mongoose');
const ejsMate = require("ejs-mate");
const { serialize, deserialize } = require("v8");
let path = require("path");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


const methodOverride = require('method-override');
app.use(methodOverride('_method'));

app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));


 let db_url=process.env.ATLASDB_URL;
main().then((res) => {
    console.log(res);
})
    .catch((err) => {
        console.log(err);
    })

async function main() {
    await mongoose.connect(db_url);
}

//schemas
let FarmerLogin = require("./models/loginFarmer");
let { AvailableInventory, Inventory } = require("./models/totalInventorySchema.js");
let { SoldInventory } = require("./models/totalInventorySchema.js");
const BuyerLogin = require("./models/loginbuyer");
const Request = require("./models/requestSchema.js");
const {isFarmer,isLoggedIn}=require("./middleware.js");


//session,flash,passport
const session = require("express-session");
const MongoStore = require('connect-mongo');
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;


//joi schema validations
let {inventorySchema,userSchema}=require("./schema.js");




let port = 8080;
app.listen(port, () => {
    console.log(port);
});
//session in production
const store = MongoStore.create({
    mongoUrl: db_url,
    crypto: {
        secret: process.env.SECRET || "devFallbackSecret"
        
    },
    touchAfter: 24 * 3600,
});


//session - cookies
const sessionsecret = {
    store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    }
};
app.use(session(sessionsecret));
app.use(flash());


//middleware
const { redirectPath } = require("./middleware.js");
// const {isOwner}=require("./middleware.js");

app.use(passport.initialize());
app.use(passport.session());

// passport.use(new LocalStrategy(FarmerLogin.authenticate()));//-- it tells passport to use farmers

// passport.serializeUser(FarmerLogin.serializeUser());//stores users details in session --->  pbkdf2 hashing algo
// passport.deserializeUser(FarmerLogin.deserializeUser());//remove stored info of user when session is complete
// Register strategies
passport.use("farmer-local", new LocalStrategy(FarmerLogin.authenticate()));
passport.use("buyer-local", new LocalStrategy(BuyerLogin.authenticate()));

// Custom serialize to store user type
passport.serializeUser(function (user, done) {
    done(null, { id: user.id, type: user.constructor.modelName });
});

// Deserialize depending on type
passport.deserializeUser(async function (obj, done) {
    const Model = obj.type === "FarmerLogin" ? FarmerLogin : BuyerLogin;
    const user = await Model.findById(obj.id);
    done(null, user);
});

//mapbox
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
map_token = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: map_token });


let validateInventory=(req,res,next)=>{
    let {error}=inventorySchema.validate(req.body);
    // console.log(result);
    if(error){
        req.flash("error",error.message);
        const redirectpath1 = res.locals.redirect || "/listings/farmers";
        return res.redirect(redirectpath1);

    }
    else{
        next();
    }
}
let validateUser=(req,res,next)=>{
    let {error}=userSchema.validate(req.body);
    // console.log(result);
    if(error){
        req.flash("error",error.message);
        const redirectpath1 = res.locals.redirect || "/";
        return res.redirect(redirectpath1);
    }
    else{
        next();
    }
}


app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currentUser = req.user;
    next();
});
app.get("/", (req, res) => {
    res.render("home.ejs");
});


app.get("/listings/farmers",isFarmer,async (req, res) => {
    try {
        const farmerId = req.user._id;
        let available = await AvailableInventory.findOne({ farmer: farmerId });
        if (!available) available = { inventory: [] };

        let sold = await SoldInventory.findOne({ farmer: farmerId });
        if (!sold) sold = { inventory: [] };
        const pendingRequests = await Request.find({ farmer: farmerId, order: "pending" });
        const hasPending = pendingRequests.length > 0;
        // console.log("Session secret:", process.env.SECRET);
        res.render("listings/farmers", { available, sold ,hasPending});
    }
    catch (err) {
        req.flash("error",err.message);
        res.redirect("/");
    }

});

//farmers
app.get("/users/loginfarmer", (req, res) => {
    res.render("users/loginfarmer.ejs");
});

app.get("/users/signupfarmer", (req, res) => {
    res.render("users/signupfarmer.ejs");
});

//signup
app.post("/users/signupfarmer",validateUser, async (req, res, next) => {
    try {
        let { username, password, email, location } = req.body;
        let newFarmer = new FarmerLogin({
            username: username,
            email: email,
            location: location
        });
        let test = await FarmerLogin.register(newFarmer, password);
        req.login(test, (err) => {
            if (err) {
                return next(err);
            }
            req.flash("success", "Welcome to Farmers Dashboard");
            res.redirect("/listings/farmers");
        })
    }
    catch (err) {
        req.flash("error", err.message);
        res.redirect("/users/signupfarmer");
    }

});

app.post("/users/loginfarmer", redirectPath, passport.authenticate("farmer-local", { failureRedirect: "/users/signupfarmer", failureFlash: true }), async (req, res) => {
    req.flash("success", "Welcome to Farmers DashBoard");
    let redirectpath1 = res.locals.redirect || "/listings/farmers";
    res.redirect(redirectpath1);;
});

//add inventory
app.get("/listings/addInventory",isFarmer, (req, res) => {
    res.render("listings/addInventory")
});
//add inventory post

app.post("/listings/addInventory",validateInventory, isFarmer,async (req, res) => {
    let { crop, price, quantity } = req.body;
    try {
        const farmerId = req.user._id;
        if (!crop || !price || !quantity) {
            req.flash("error", "All fields are required.");
            return res.redirect("/listings/addInventory");
        }
        crop = crop.toLowerCase();
        let available = await AvailableInventory.findOne({ farmer: farmerId });
        if (!available) {
            available = new AvailableInventory({
                farmer: farmerId,
                inventory: [{ crop: crop, price, quantity }]
            });
        } else {
            let cropFound = false;
            for (let item of available.inventory) {
                if (item.crop === crop) {
                    item.quantity += Number(quantity);
                    cropFound = true;
                    break;
                }
            }
            if (!cropFound) {
                available.inventory.push({
                    crop: crop,
                    price,
                    quantity
                });
            }
        }

        await available.save();
        res.redirect("/listings/farmers");

    } catch (err) {
        console.error("Error updating inventory:", err);
        req.flash("error", "Something went wrong while adding inventory.");
        res.redirect("/");
    }
});

//update
app.get("/listings/update", isFarmer,async (req, res) => {
    let farmerId = req.user._id;
    let available = await AvailableInventory.findOne({ farmer: farmerId });
    res.render("listings/update", { available });
});

//post update one 
app.patch("/listings/update/:crop",isFarmer, async (req, res) => {
    try {
        let farmerId = req.user._id;
        let crop = req.params.crop;
        let { quantity, price } = req.body;
        await AvailableInventory.updateOne(
            { farmer: farmerId, "inventory.crop": crop },
            {
                $set: {
                    "inventory.$.quantity": quantity,
                    "inventory.$.price": price
                }
            }
        );
        res.redirect("/listings/farmers");
    }
    catch (err) {
        console.error("Error updating inventory:", err);
        req.flash("error", "Something went wrong while Updating inventory.");
        res.redirect("/listings/farmers");
    }
});

//delete one

app.get("/listings/delete/:crop",isFarmer, async (req, res) => {
    try {
        let farmerId = req.user._id;
        let crop = req.params.crop;
        await AvailableInventory.updateOne(
            { farmer: farmerId },
            { $pull: { inventory: { crop: crop } } }
        );
        res.redirect("/listings/farmers");
    }
    catch (err) {
        console.error("Error Deleting inventory:", err);
        req.flash("error", "Something went wrong while Deleting inventory.");
        res.redirect("/listings/farmers");
    }

});
//login buyer
app.get("/users/loginbuyer",async (req, res) => {
    res.render("users/loginbuyer.ejs");
})

//buyer dashboard
app.get("/listings/buyer",isLoggedIn,async (req, res) => {
    try{
      let buyerId=req.user._id;
      let buyername=req.user.username;
      let requests=await Request.find({buyer:buyerId}).populate("farmer");
      res.render("listings/buyer.ejs",{requests,buyername});
    }
    catch(err){
        req.flash("error occured");
    }
});
//signup buyer get
app.get("/users/signupbuyer", (req, res) => {
    res.render("users/signupbuyer.ejs");
});

app.post("/users/loginbuyer", redirectPath, passport.authenticate("buyer-local", { failureRedirect: "/users/signupbuyer", failureFlash: true }), async (req, res) => {
    req.flash("success", "Welcome to Buyer's DashBoard");
    let redirectpath1 = res.locals.redirect || "/listings/buyer";
    res.redirect(redirectpath1);
});

app.post("/users/signupbuyer",validateUser, async (req, res) => {
    try {
        let { username, email, location, password } = req.body;
        let buyer = new BuyerLogin({
            username: username,
            email: email,
            location: location
        });
        let response = await geocodingClient.forwardGeocode({
            query: location,
            limit: 1
        })
            .send()
        buyer.geometry = response.body.features[0].geometry;
        let test = await BuyerLogin.register(buyer, password);
        let buyerdata = await BuyerLogin.find({});
        req.login(test, (err) => {
            if (err) {
                return next(err);
            }
            req.flash("success", "Welcome to Buyers Dashboard");
            res.redirect("/listings/buyer");
        })

    }
    catch (err) {
        req.flash("error", err.message);
        res.redirect("/users/signupbuyer");
    }
});

//order
app.get("/listings/Orders",isLoggedIn, async (req, res) => {
    let location = req.user.location;
    let buyerdata = await BuyerLogin.find({});

    let response = await geocodingClient.forwardGeocode({
        query: location,
        limit: 1
    })
    .send();
    let coordinate = response.body.features[0].geometry;
    res.render("listings/order.ejs", { buyerdata, coordinate });
});

//request
app.post("/request/send",isLoggedIn, async (req, res) => {
    try {
        let farmerId = req.user._id;
        let buyerId = req.body.buyerId;
        if (!req.user || !req.user._id) {
            console.log("🚫 No user found in req");
            req.flash("error", "🚫 No user found in req");
            res.redirect("/listings/Orders");            
        }
        //if already request is in pending
        let existingRequest = await Request.findOne({
            farmer: farmerId,
            buyer: buyerId,
            order: "pending", // order status is NOT rejected
        });

        if (existingRequest) {
            req.flash("error", "You already have a pending request with this buyer. Wait until it is rejected before sending a new one.");
            res.redirect("/listings/Orders");
        }
        let inventorysent = await AvailableInventory.findOne({ farmer: farmerId });
        const inventorySent = inventorysent.inventory.map(crop => ({
            crop: crop.crop,
            quantity: crop.quantity,
            price: crop.price
        }));
        if (!inventorySent) {
             req.flash("error", "No inventory found.");
            res.redirect("/listings/Orders");   
        }
        console.log(inventorySent);
        let request = new Request({
            farmer: farmerId,
            buyer: buyerId,
            inventorySent: inventorySent,
            order: "pending"
        });
        await request.save();
        console.log("✅ Request saved");
       req.flash("success", "✅ Request sent successfully!");
       res.redirect("/listings/Orders");
        // res.status(200).json({ message: "Request sent successfully." });
        
    }
    catch (err) {
        req.flash("error", "Server error occurred.");
        res.redirect("/listings/Orders");
    }
});

// delete all requests 
app.get("/requests/deleteall", isLoggedIn, async (req, res) => {
  try {
   
    const farmerId = req.user._id;
    if (!farmerId) {
      req.flash("error","Please Login");
      res.redirect("/listings/Orders");
    }

    // Delete all requests by this farmer where order is NOT rejected
    const result = await Request.deleteMany({
      farmer: farmerId,
      order: "pending",
    });

    req.flash("success","Successfully deleted");
    res.redirect("/listings/Orders");

  } catch (error) {
    console.error(error);
    req.flash("error",error.message);
    res.redirect("/listings/Orders");
  }
});
app.get("/request/view/:id",isLoggedIn,async (req,res)=>{
    let requestId=req.params.id;
    let request=await Request.findById(requestId).populate("farmer");
    res.render("listings/requestview",{request});
});

//accept button
app.post("/accept-inventory/:id",isLoggedIn,async (req,res)=>{
    try{
        let requestId=req.params.id;
        let request=await Request.findById(requestId).populate("farmer");
        let crop=req.body.crop;
        let quantity=req.body.quantity;
        let price=req.body.price;
        let farmerId=request.farmer._id;
        let c=0;
        for(let q of quantity){
            if(q=='0'){
                c++;
            }
        }
        if(c==quantity.length){
            req.flash("error","Atleast buy one product to accept");
            return res.redirect("/listings/buyer");
        }
        let inventoryaccepted = [];
        let totalprice=0;

        for (let i = 0; i < crop.length; i++) {
            if (quantity[i] > 0) {
                inventoryaccepted.push({
                    crop: crop[i],
                    quantity: Number(quantity[i]),
                    price: Number(price[i])
                });
                totalprice+=Number(quantity[i]*price[i]);
            }
        }
        request.inventoryaccepted=inventoryaccepted;
        request.order="accepted";
        await request.save();
        const requestdelete=await Request.deleteMany({
            farmer:farmerId,
            order:"pending"
        });
        
        let inventorySold=await SoldInventory.findOne({farmer:farmerId});
        if(!inventorySold){
             inventorySold=new SoldInventory({
                farmer:farmerId,
                inventory: [...inventoryaccepted]
            });
        }
        else{
            for (let item of request.inventoryaccepted) {
                const existing = inventorySold.inventory.find(inv =>
                    inv.crop === item.crop && inv.price === item.price
                );

                if (existing) {
                    existing.quantity += item.quantity;
                } else {
                    inventorySold.inventory.push(item);
                }
            }
        }
        await inventorySold.save();
        let available=await AvailableInventory.findOne({farmer:farmerId});
        if(available){
            for (let item of request.inventoryaccepted) {
                const existing = available.inventory.find(inv =>
                    inv.crop === item.crop && inv.price === item.price
                );
            if (existing) {
                existing.quantity -= item.quantity;
                    // Remove the item if quantity becomes 0
                    if (existing.quantity <= 0) {
                        available.inventory = available.inventory.filter(inv =>
                            !(inv.crop === item.crop && inv.price === item.price)
                        );
                    }
                }
                await available.save();
            }
        }
        
        req.flash("success","Your Purchase is done Successfully");
        res.redirect("/listings/buyer");
    }
    catch(err){
        req.flash("error",err.message);
        res.redirect("/listings/buyer");
    }
});
//buyer orders
app.get("/dashboard/buyer", isLoggedIn,async (req, res) => {
    try {
        const buyerId = req.user._id;
        const buyername=req.user.username;
        const orders = await Request.find({ 
            buyer: buyerId, 
            order: "accepted" 
        })
        .populate("farmer")
        .sort({ createdAt: -1 });

        res.render("listings/buyerorder", { orders ,buyername});
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/");
    }
});
//farmer orders
app.get("/dashboard/farmer",isLoggedIn, async (req, res) => {
    try {
        const farmerId = req.user._id;
        const farmername=req.user.username;
        const orders = await Request.find({ 
            farmer: farmerId, 
            order: "accepted" 
        })
        .populate("buyer")
        .sort({ createdAt: -1 });

        res.render("listings/farmerorders", { orders,farmername });
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/");
    }
});
//logoutfarmer
app.get("/logoutfarmer",(req,res,next)=>{
    // console.log(req.user);
    req.logout((err)=>{
        if(err){
            return next(err);
        }
        req.flash("success","Logged out successfully");
        res.redirect("/");
    });
    
});
//logoutbuyer
app.get("/logoutbuyer",(req,res,next)=>{
    // console.log(req.user);
    req.logout((err)=>{
        if(err){
            return next(err);
        }
        req.flash("success","Logged out successfully");
        res.redirect("/");
    });
});
app.get("/request/map/:id",isLoggedIn,async (req,res)=>{
    let requestId=req.params.id;
    let request=await Request.findById(requestId).populate("farmer").populate("buyer");
    let farmerlocation=request.farmer.location;
    let buyerlocation=request.buyer.location;
    let farmers = await geocodingClient.forwardGeocode({
        query: farmerlocation,
        limit: 1
    })
    .send();
    let farmercoordinate = farmers.body.features[0].geometry;
    let buyers = await geocodingClient.forwardGeocode({
        query: buyerlocation,
        limit: 1
    })
    .send();
    let buyercoordinate = buyers.body.features[0].geometry;
    console.log(buyercoordinate.coordinates,farmercoordinate.coordinates)

    res.render("listings/viewRequestmap.ejs",{farmercoordinate,buyercoordinate});
});

