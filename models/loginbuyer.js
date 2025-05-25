let mongoose=require("mongoose");
let Schema=mongoose.Schema;
const passportLocalMongoose=require("passport-local-mongoose");
let buyerSchema=new Schema({
    email:{
        type:String,
        required:true//username and password are inbuilt in passport
    },
    geometry:{
        type:{
            type:String,
            enum:["Point"],
            required:true
        },
        coordinates:{
            type:[Number],
            required:true
        }
    },
    location:{
        type:String,
        required:true
    },
});
buyerSchema.plugin(passportLocalMongoose);
buyerSchema.index({ geometry: "2dsphere" });
module.exports=mongoose.model("BuyerLogin",buyerSchema);