import { User } from "../models/user.model.js";
import ApiError from "../utils/api_error.js";
import { ApiResponse } from "../utils/api_response.js";
import { asyncHandler } from "../utils/async_handler.js";
import { uploadFileToCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler( async (req, res) => {
    // 1. fetch the data from the user(frontend)
    // 2. validate the text fields whether it is empty or not
    // 3. If it is empty, throw an Error, or else move to the next step
    // 4. fetch the files from the user, and perform some basic validation
    // 5. upload the files to cloudinary
    // 6. check whether the file is successfully uploaded to cloudinary or not. 
    // If it is not uploaded successfully, throw an error or else move to the next step.
    // 7. check whether the user is present in the db or not. If it is not present, 
    // throw an error, or else create a user object.
    // 8. Remove the password and refreshToken from the response.
    // 9. Display the successfull response.

    const { username, email, fullName, password } = req.body

    // console.log(`username: ${username}, email: ${email}, fullName: ${fullName}, password: ${password}`)

    if (
        [username, email, fullName, password]
        .some((element) => element?.trim() === '')
    ) {
        throw new ApiError(400, 'All fields are required!')
    }

    const files = req.files
    const avatarLocalFilePath = files?.avatar?.[0]?.path
    const coverImageLocalFilePath = files?.coverImage?.[0]?.path

    // console.log(`avatarLocalFilePath: ${avatarLocalFilePath}, coverImageLocalFilePath: ${coverImageLocalFilePath}`)

    if(!avatarLocalFilePath) {
        throw new ApiError(400, 'Avatar file is required!')
    }

    const avatar = await uploadFileToCloudinary(avatarLocalFilePath)
    const coverImage = await uploadFileToCloudinary(coverImageLocalFilePath)

    if (!avatar?.url) {
        throw new ApiError(500, 'Failed to upload avatar to Cloudinary!');
    }

    // console.log(`avatar: ${avatar.url}, coverImage: ${coverImage.url}`)

    const isUserExists = await User.findOne(
        {
            $or: [ {username}, {email} ]
        }
    )

    if(isUserExists) {
        throw new ApiError(409, "User with email or username already exists!")
    }

    const user = await User.create({
        username: username.toLowerCase(),
        email,
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || '',
        password
    })

    const createdUser = await User.findById(user._id).select(
        '-password -refreshToken'
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(
            200, createdUser, 'User registered Successfully!'
        )
    )
})

export { registerUser }
