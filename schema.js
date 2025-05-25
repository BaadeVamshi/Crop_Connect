const Joi=require("joi");


module.exports.inventorySchema = Joi.object({
  crop: Joi.string()
  .trim()
  .min(2)
  .pattern(/^[A-Za-z\s]+$/) // ✅ Only letters and spaces
  .required()
  .messages({
    "string.empty": "Crop name cannot be empty",
    "string.min": "Crop name must be at least 2 characters",
    "string.pattern.base": "Crop name must only contain letters"
  }),

  quantity: Joi.number().positive().required().messages({
    "number.base": "Quantity must be a number",
    "number.positive": "Quantity must be positive",
    "any.required": "Quantity is required"
  }),
  price: Joi.number().positive().required().messages({
    "number.base": "Price must be a number",
    "number.positive": "Price must be positive",
    "any.required": "Price is required"
  })
});



module.exports.userSchema = Joi.object({
  name: Joi.string().min(2).required().messages({
        "string.min": "Full name must be at least 2 characters",
        "any.required": "Full name is required"
    }),
    email: Joi.string()
        .email()
        .regex(/^[a-zA-Z0-9._%+-]+@gmail\.com$/)
        .required()
        .messages({
            "string.pattern.base": "Only Gmail accounts are allowed!",
            "string.email": "Invalid email format!",
            "any.required": "Email is required!"
        }),
    username: Joi.string().min(2).required().messages({
        "string.min": "Username must be at least 3 characters long",
        "any.required": "Username is required!"
    }),
    password: Joi.string().min(6).required().messages({
        "string.min": "Password must be at least 6 characters long",
        "any.required": "Password is required!"
    }),
    location: Joi.string().required().messages({
        "any.required": "Location is required!"
    })
});
