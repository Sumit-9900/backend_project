import { User } from "../models/user.model.js";
import ApiError from "../utils/api_error.js";
import { ApiResponse } from "../utils/api_response.js";
import { asyncHandler } from "../utils/async_handler.js";
import { uploadFileToCloudinary } from "../utils/cloudinary.js";
import jwt from 'jsonwebtoken'

 const options = {
    httpOnly: true,
    secure: true
}

const generateAccessAndRefereshTokens = async(user) => {
    try {
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

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

const loginUser = asyncHandler(async (req, res) => {
    // 1. validate the user input
    // 2. fetch the data from the db and check whether the email
    // and password enterred by the user is correct or not. If not
    // correct, return an error message, or else return a success message
    // along with json response containing the refresh and access token.

    const { username, email, password } = req.body

    if((!(username || email)) || !password) {
        throw new ApiError(400, 'All fields are required!')
    }

    const user = await User.findOne({
        $or: [
            {username}, {email}
        ]
    })

    // console.log(`user: ${user}`)

    if(!user) {
        throw new ApiError(404, 'User does not exist!')
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid) {
        throw new ApiError(401, 'Invalid User credentials!')
    }

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user)

    const loggedInUser = await User.findById(user._id).select(
        '-password -refreshToken'
    )

    return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
        new ApiResponse(200, 
            {user: loggedInUser, accessToken, refreshToken}, 
            'User LogIn Successfully!'
        )
    )   
})

const logoutUser = asyncHandler(async (req, res) => {
    const user = req.user

    await User.findByIdAndUpdate(
        user._id, 
        {
        $unset: {
            refreshToken: 1
            },
        },
        {
            new: true
        }
    )

    res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(
        200,
        {},
        'User Logged Out Successfully!'
    ))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    // console.log(`Refresh Token: ${incomingRefreshToken}`)

    if(!incomingRefreshToken) {
        throw new ApiError(401, 'Unauthorized request!')
    }

    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

    // console.log('Decoded Token: ', decodedToken)

    const user = await User.findById(decodedToken._id)

    if(!user) {
        throw new ApiError(401, 'Invalid refresh token!')
    }

    if(incomingRefreshToken !== user.refreshToken) {
        throw new ApiError(401, 'Refresh token is not valid!')
    }

    const {accessToken: newAccessToken,refreshToken: newRefreshToken} = await generateAccessAndRefereshTokens(user)

    if(! (newAccessToken || newRefreshToken)) {
        throw new ApiError(500, 'Unable to generate access or refresh token!')
    }

    // console.log(`newAccessToken: ${newAccessToken}, newRefreshToken: ${newRefreshToken}`)

    return res
    .status(200)
    .cookie('accessToken', newAccessToken, options)
    .cookie('refreshToken', newRefreshToken, options)
    .json(new ApiResponse(
        200, 
        {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        },
        'Access token generated successfully!'
    ))
})

export { registerUser, loginUser, logoutUser, refreshAccessToken }
