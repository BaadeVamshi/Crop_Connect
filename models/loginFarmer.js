const mongoose=require("mongoose");
let Schema=mongoose.Schema;
const passportLocalMongoose=require("passport-local-mongoose");
let farmerSchema=new Schema({
    email:{
        type:String,
        required:true//username and password are inbuilt in passport
    },
    location:{
        type:String,
        required:true
    },
});
farmerSchema.plugin(passportLocalMongoose);
module.exports=mongoose.model("FarmerLogin",farmerSchema);
