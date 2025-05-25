module.exports.redirectPath=(req,res,next)=>{
    if(req.session.redirectpath){
        res.locals.redirect=req.session.redirectpath;
    }
    next();
}

module.exports.isFarmer=(req, res, next)=> {
    if (req.user && req.user.constructor.modelName === "FarmerLogin") return next();
    req.flash("error", "Access denied.");
    res.redirect("/");
}
module.exports.isLoggedIn=(req, res, next) =>{
    if (!req.isAuthenticated()) {
        req.flash("error", "You must be logged in first!");
        return res.redirect("/");
    }
    next();
}
