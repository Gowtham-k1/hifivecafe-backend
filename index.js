const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const mysql = require("mysql")
const path = require("path")
const fileupload = require("express-fileupload")
const { Console } = require("console")
const app = express()
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(fileupload())
app.use("/images", express.static('images'));


const con = mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "Boop@thi@2003",
    database: "hifivedatabase",
});

con.connect((err) => {
    if (err) {
        console.error("Error connecting to database:", err.stack);
        return;
    }
    console.log("Connected to database");
});


// ================================================================================register

app.post('/usertable', (req, res) => {
    const passworddcrypt = req.body.password;
    const password = btoa(passworddcrypt)
    const name = req.body.name;
    const phone_number = req.body.phone_number;
    const email = req.body.email;
    const currentdate = new Date();

    const signin = "select * from users where email = ? ";
    con.query(signin, [email], (err, result) => {
        if (err) {
            let sts = {
                "status": "error",
            }
            res.send(sts);
        } else if (result.length == 0) {
            const sql = 'insert into users(name,mobile,email,password,created_at)values(?,?,?,?,?)'
            con.query(sql, [name, phone_number, email, password, currentdate], (error, result) => {

                if (error) {
                    var sts = {
                        "status": "error",
                    }
                    res.send(sts);

                } else {
                    const sql = 'select * from users where email =?'
                    con.query(sql, [email], (error, result) => {
                        if (error) {
                            var sts = {
                                "status": "error",
                            }
                            res.send(sts);

                        } else {

                            var sts = {
                                "status": "successfully",
                                detail: result

                            }
                            res.send(sts);

                        }
                    })
                }
            })

        } else {

            let email1 = result[0].email;

            if (email1 == email) {
                let sts = {
                    "status": "email already exist",
                    detail: result

                }

                res.send(sts);


            }


        }
    })


})


// =========================================signin=============================================


app.post("/signin", (req, res) => {
    let email = req.body.email;
    let password = req.body.password;

    const signin = "select * from users where email = ? ";
    con.query(signin, [email], (err, result) => {

        if (err) {
            let sts = {
                "status": "no email id",
            }
            res.send(sts);
        }
        else if (result.length > 0) {
            let email1 = result[0].email;
            let password1 = atob(result[0].password)

            if (email1 == email && password1 == password) {
                let sts = {
                    "status": "success",
                    details: result

                }

                res.send(sts);



            }


        } else {
            let sts = {
                "status": "no records",


            }

            res.send(sts);

        }
    })
})








//reservation insert information api
app.post("/reservation/insert/data", async (req, res) => {
    try {
        const { reser_title, reser_main_title, description } = req.body;
        const reser_img = req.files ? req.files.reser_img : null;
        const video = req.files ? req.files.media : null
        const extra_imgs = req.files ? (Array.isArray(req.files.img) ? req.files.img : [req.files.img]) : [];

        // Validate required fields
        if (!reser_title || !reser_img) {
            return res.json({
                success: '0',
                message: "Reservation title and image are required!",
            });
        }

        if (!video && req.files.media) {
            return res.send({
                success: '0',
                message: "video required!",
            });
        }
        // Validate file extensions
        const allowedExtensions = ["jpg", "jpeg", "png"];
        const filename = reser_img.name;
        const fileExtension = filename.split(".").pop().toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
            return res.json({
                success: '0',
                message: "File type not supported.",
            });
        }

        // Move and handle main image
        const imageUrl = await moveImage(reser_img);

        // Move and handle extra images
        const uploadedFiles = await Promise.all(extra_imgs.map(moveImage));

        const imges = JSON.stringify(uploadedFiles);


        //video add code
        let videofile;
        if (req.files && req.files.media) {
            try {
                const video = req.files.media;
                const timestamp = Date.now();
                const fileName = `${timestamp}_${video.name}`;
                const imagePath = path.join(__dirname, "video", fileName);
                await video.mv(imagePath); // Move the new image
                videofile = fileName;
            } catch (error) {
                console.error("Error uploading file:", error);
                return res.json({
                    Response: {
                        success: '0',
                        message: "Error uploading file."
                    }
                });
            }
        }

        const formattedDate = new Date();

        // Insert data into MySQL table
        const sql = `INSERT INTO reservation (reser_title,reser_main_title, reser_image, description, extra_img,reser_videos, created_at) VALUES (?, ?, ?, ?, ?,?,?)`;
        const sqlValues = [reser_title, reser_main_title, imageUrl, description, imges, videofile, formattedDate];

        con.query(sql, sqlValues, (error, result) => {
            if (error) {
                return res.json({
                    success: '0',
                    message: error.message, // Sending only error message
                });
            } else {
                return res.json({
                    success: '1',
                    message: "Reservation category added successfully!",
                });
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: '0',
            message: error.message,
        });
    }
});

async function moveImage(image) {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${image.name}`;
    const imagePath = path.join(__dirname, "images", fileName);

    return new Promise((resolve, reject) => {
        image.mv(imagePath, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve(fileName);
            }
        });
    });
}



//reservation update api


app.post("/reservation/update/api", async (req, res) => {
    try {
        const id = req.body.reser_id;
        if (!id) {
            return res.json({
                success: '0',
                message: "Reservation ID required!"
            });
        }

        const existingReservation = await getExistingReservation(id);

        if (!existingReservation) {
            return res.json({
                success: '0',
                message: "Reservation not found."
            });
        }

        const { reser_title, description, status } = req.body;
        let { reser_image, extra_imgs } = await handleImages(req.files, existingReservation);

        const updatedTitle = reser_title || existingReservation.reser_title;
        const updatedDescription = description || existingReservation.description;
        const updateStatus = status || existingReservation.status;

        const updateResult = await updateReservation(id, updatedTitle, reser_image, updatedDescription, extra_imgs, updateStatus);

        return res.json({
            success: '1',
            message: "Reservation updated successfully!"
        });
    } catch (error) {
        return res.status(500).json({
            success: '0',
            message: error.message,
        });
    }
});

async function getExistingReservation(id) {
    const sql = `SELECT * FROM reservation WHERE status="1" AND reser_id=${id}`;
    const [rows] = await query(sql);
    console.log(rows)
    return rows;
}

async function handleImages(files, existingReservation) {
    let reser_image = existingReservation.reser_image;
    let extra_imgs = [];

    if (files) {
        if (files.reser_image) {
            reser_image = await handleReserImage(files.reser_image);
        }
        if (files.img) {
            extra_imgs = await handleExtraImages(files.img, existingReservation.extra_img);
        }
    }

    return { reser_image, extra_imgs };
}

async function handleReserImage(reserImg) {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${reserImg.name}`;
    const imagePath = path.join(__dirname, "images", fileName);
    await reserImg.mv(imagePath);
    return fileName;
}

async function handleExtraImages(extraImgs, existingExtraImagesJson) {
    const currentExtraImages = JSON.parse(existingExtraImagesJson || "[]");
    const uploadedFiles = await Promise.all(
        Array.isArray(extraImgs) ? extraImgs.map(moveImage) : [moveImage(extraImgs)]
    );
    return uploadedFiles.length > 0 ? uploadedFiles : currentExtraImages;
}

async function updateReservation(id, title, image, description, extraImgs, status) {
    const updatedExtraImagesJson = JSON.stringify(extraImgs);
    const sql = `UPDATE reservation SET reser_title=?, reser_image=?, description=?, extra_img=?, status=? WHERE reser_id=?`;
    return query(sql, [title, image, description, updatedExtraImagesJson, status, id]);
}

function query(sql, values) {
    return new Promise((resolve, reject) => {
        con.query(sql, values, (error, results, fields) => {
            if (error) {
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
}



//reservation list api 

app.get("/reservation/overall/list", async (req, res) => {
    const reser_id = req.query.reser_id
    let sql;
    if (!reser_id) {
        sql = `select * from reservation where status="1"`
    } else {
        sql = `select * from reservation where status="1" and reser_id=${reser_id}`
    }
    const exesqlquery = await executeQuery(sql)

    if (exesqlquery.length > 0) {

        const firstimgurl = 'http://localhost:3004/images/';
        const Arrayimgurl = 'http://localhost:3004/images/';

        const result = exesqlquery.map((item) => {
            const extraImages = JSON.parse(item.extra_img).map(imageName => Arrayimgurl + imageName);

            return {
                reser_id: item.reser_id,
                reser_title: item.reser_title,
                reser_main_title: item.reser_main_title,
                reser_image: firstimgurl + item.reser_image,
                description: item.description,
                extra_img: extraImages,
                status: item.status,
                created_at: item.created_at,
                updated_at: item.updated_at,
            };
        });
        const response = {
            Response: {
                Success: "1",
                message: "Success",
                result: result
            }
        };
        return res.json(response);
    }
    else {
        const response = {
            Response: {
                Success: "0",
                message: "No Records!",
            }
        };
        return res.json(response);
    }
})


app.get("/reservation/website/overall/list", async (req, res) => {
    const reser_id = req.query.reser_id
    let sql;
    let objfile = {};
    let Arrayresposne = [];
    if (!reser_id) {
        sql = `select * from reservation where status="1"`
    } else {
        sql = `select * from reservation where status="1" and reser_id=${reser_id}`
    }
    const exesqlquery = await executeQuery(sql)

    if (exesqlquery.length > 0) {

        const videosql = `select * from video where video_status="1" and type="RESERVATION"`
        const executevideoquery = await executeQuery(videosql)
        if (executevideoquery.length > 0) {

            const videourl = 'http://localhost:3004/images/';


            objfile['video'] = videourl + executevideoquery[0].video_file;



        }

        const firstimgurl = 'http://localhost:3004/images/';
        const Arrayimgurl = 'http://localhost:3004/images/';

        const result = exesqlquery.map((item) => {
            const extraImages = JSON.parse(item.extra_img).map(imageName => Arrayimgurl + imageName);

            return {
                reser_id: item.reser_id,
                reser_title: item.reser_title,
                reser_main_title: item.reser_main_title,
                reser_image: firstimgurl + item.reser_image,
                description: item.description,
                extra_img: extraImages,
                status: item.status,
                created_at: item.created_at,
                updated_at: item.updated_at,
            };
        });
        objfile['reservation_ilst'] = result;
        Arrayresposne.push(objfile)
        const response = {
            Response: {
                Success: "1",
                message: "Success",
                result: Arrayresposne
            }
        };
        return res.json(response);
    }
    else {
        const response = {
            Response: {
                Success: "0",
                message: "No Records!",
            }
        };
        return res.json(response);
    }
})




//reservation  category add api


app.post("/reservation/category/add", async (req, res) => {
    const cat_title = req.body.cat_title;
    const price_range = req.body.price_range;
    const reser_cat_id = req.body.reser_cat_id;
    const cat_image = req.files ? req.files.cat_image : null;
    const video = req.files ? req.files.media : null
    if (!cat_title) {
        return res.send({
            success: '0',
            message: "reservation category title required!",
        });
    }
    if (!cat_image && req.files.cat_image) {
        return res.send({
            success: '0',
            message: "reservation  category image required!",
        });
    }

    if (!video && req.files.media) {
        return res.send({
            success: '0',
            message: "video required!",
        });
    }
    const filename = cat_image.name;
    const fileExtension = filename.split(".").pop().toLowerCase();
    const allowedExtensions = ["jpg", "jpeg", "png"];

    if (!allowedExtensions.includes(fileExtension)) {
        const response = {
            Response: {
                Success: "0",
                Message: "File type not supported.",

            }
        };
        return res.json(response);
    }
    const currentDate = new Date();
    const timestamp = currentDate.getTime();
    const imageUrl = timestamp + "_" + filename;
    console.log(imageUrl)

    const imagePath = path.join(
        __dirname,
        "./", "images",
        imageUrl);

    cat_image.mv(imagePath, (error) => {
        if (error) {
            const response = {
                Response: {
                    Success: "0",
                    Message: "Error uploading image.",

                }
            };
            return res.json(response)
        }
    })


    //video add api 
    let videofile;
    if (req.files && req.files.media) {
        try {
            const video = req.files.media;
            const timestamp = Date.now();
            const fileName = `${timestamp}_${video.name}`;
            const imagePath = path.join(__dirname, "video", fileName);
            await video.mv(imagePath); // Move the new image
            videofile = fileName;
        } catch (error) {
            console.error("Error uploading file:", error);
            return res.json({
                Response: {
                    success: '0',
                    message: "Error uploading file."
                }
            });
        }
    }

    const formattedDate = new Date()
    const sql = `INSERT INTO reservation_category (cat_title,cat_image,reser_id,price_range,videos,created_at) VALUES (?,?,?,?,?,?)`;

    const sqlValues = [cat_title, imageUrl, reser_cat_id, price_range, videofile, formattedDate];

    con.query(sql, sqlValues, (error, result) => {
        if (error) {
            const response = {
                Response: {
                    Success: "0",
                    Message: "Error inserting data.",

                }
            };
            return res.json(response);
        } else {
            const response = {
                Response: {
                    Success: "1",
                    Message: "reservation Category added successfully!",

                }
            };
            return res.json(response);

        }
    });
})


// reservation category list api for admin panel


// app.get("/reservation/category/admin/list", async (req, res) => {
//     const resercat_id = req.query.resercat_id
//     let sql;
//     if (!resercat_id) {
//         sql = `select * from reservation_category where cat_status="1"`
//     } else {
//         sql = `select * from reservation_category where cat_status="1" and cat_id=${resercat_id}`
//     }
//     const exesqlquery = await executeQuery(sql)

//     if (exesqlquery.length > 0) {

//         const firstimgurl = 'http://localhost:3004/images/';


//         const result = exesqlquery.map((item) => {
//             return {
//                 cat_id: item.cat_id,
//                 cat_title: item.cat_title,
//                 cat_image: firstimgurl + item.cat_image,
//                 reser_id: item.reser_id,
//                 price_range: item.price_range,
//                 cat_status: item.cat_status,
//                 created_at: item.created_at,
//                 updated_at: item.updated_at,
//             };
//         });
//         const response = {
//             Response: {
//                 Success: "1",
//                 message: "Success",
//                 result: result
//             }
//         };
//         return res.json(response);
//     }
//     else {
//         const response = {
//             Response: {
//                 Success: "0",
//                 message: "No Records!",
//             }
//         };
//         return res.json(response);
//     }
// })


app.get("/reservation/category/admin/list", async (req, res) => {
    const resercat_id = req.query.resercat_id
    let sql;
    if (!resercat_id) {
        sql = `select * from reservation_category where cat_status = "1"`
    } else {
        sql = `select * from reservation_category where cat_status = "1" and reser_id = ${resercat_id}`
    }
    const exesqlquery = await executeQuery(sql)

    if (exesqlquery.length > 0) {

        const firstimgurl = 'http://localhost:3004/images/';


        const result = exesqlquery.map((item) => {
            return {
                cat_id: item.cat_id,
                cat_title: item.cat_title,
                cat_image: firstimgurl + item.cat_image,
                reser_id: item.reser_id,
                price_range: item.price_range,
                cat_status: item.cat_status,
                created_at: item.created_at,
                updated_at: item.updated_at,
            };
        });
        const response = {
            Response: {
                Success: "1",
                message: "Success",
                result: result
            }
        };
        return res.json(response);
    }
    else {
        const response = {
            Response: {
                Success: "0",
                message: "No Records!",
            }
        };
        return res.json(response);
    }
})


app.get("/reservation/category/get/list", async (req, res) => {
    const reser_id = req.query.reser_id

    let objfile = {};
    let Arrayresposne = [];

    let sql = `select * from reservation where status="1" and reser_id=${reser_id}`
    const exesqlquery = await executeQuery(sql)

    if (exesqlquery.length > 0) {
        const videourl = 'http://localhost:3004/images/';
        objfile['video'] = videourl + exesqlquery[0].reser_videos;
        objfile['reser_title'] = exesqlquery[0].reser_main_title;

        let reservationcategorysql = `select * from reservation_category where cat_status="1" and reser_id=${reser_id}`
        const executereservationcategorysql = await executeQuery(reservationcategorysql)

        if (executereservationcategorysql.length > 0) {
            const firstimgurl = 'http://localhost:3004/images/';
            const result = executereservationcategorysql.map((item) => {
                return {
                    cat_id: item.cat_id,
                    cat_title: item.cat_title,
                    reser_id: item.reser_id,
                    cat_image: firstimgurl + item.cat_image,
                    price_range: item.price_range,
                    cat_status: item.cat_status,
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                };
            });
            objfile['reservation_category_list'] = result;
            Arrayresposne.push(objfile)

            const response = {
                Response: {
                    Success: "1",
                    message: "Success",
                    result: Arrayresposne
                }
            }
            res.send(response)

        } else {
            const response = {
                Response: {
                    Success: "0",
                    message: "No Records!",
                }
            };
            return res.json(response);
        }
    }
    else {
        const response = {
            Response: {
                Success: "0",
                message: "No Records!",
            }
        };
        return res.json(response);
    }
})



//reservation sub category add api

app.post("/reservation/subcategory/insert/data", async (req, res) => {
    try {
        const { sub_tilte, reser_cat_id, reser_id, sub_cat_price_range } = req.body;
        const sub_img = req.files ? req.files.sub_img : null;
        const extra_imgs = req.files ? (Array.isArray(req.files.img) ? req.files.img : [req.files.img]) : [];

        // Validate required fields
        if (!sub_tilte || !reser_cat_id || !reser_id || !sub_img || !sub_cat_price_range) {
            return res.json({
                success: '0',
                message: "All Feilds required!",
            });
        }

        // Validate file extensions
        const allowedExtensions = ["jpg", "jpeg", "png"];
        const filename = sub_img.name;
        const fileExtension = filename.split(".").pop().toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
            return res.json({
                success: '0',
                message: "File type not supported.",
            });
        }

        // Move and handle main image
        const imageUrl = await moveImage(sub_img);

        // Move and handle extra images
        const uploadedFiles = await Promise.all(extra_imgs.map(moveImage));

        const imges = JSON.stringify(uploadedFiles);
        const formattedDate = new Date();

        // Insert data into MySQL table
        const sql = `INSERT INTO reservation_sub_category (sub_tilte, reser_cat_id, reser_id, sub_img,sub_extra_img, sub_cat_price_range,created_at) VALUES (?, ?, ?, ?, ?,?,?)`;
        const sqlValues = [sub_tilte, reser_cat_id, reser_id, imageUrl, imges, sub_cat_price_range, formattedDate];

        con.query(sql, sqlValues, (error, result) => {
            if (error) {
                return res.json({
                    success: '0',
                    message: error.message, // Sending only error message
                });
            } else {
                return res.json({
                    success: '1',
                    message: "Reservation subcategory added successfully!",
                });
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: '0',
            message: error.message,
        });
    }
});


//website get list api

app.get("/reservation/category/get/list", async (req, res) => {
    const reser_id = req.query.reser_id

    let objfile = {};
    let Arrayresposne = [];

    let sql = `select * from reservation where status="1" and reser_id=${reser_id}`
    const exesqlquery = await executeQuery(sql)

    if (exesqlquery.length > 0) {
        const videourl = 'http://localhost:3004/images/';
        objfile['video'] = videourl + exesqlquery[0].reser_videos;
        objfile['reser_title'] = exesqlquery[0].reser_main_title;

        let reservationcategorysql = `select * from reservation_category where cat_status="1" and reser_id=${reser_id}`
        const executereservationcategorysql = await executeQuery(reservationcategorysql)

        if (executereservationcategorysql.length > 0) {
            const firstimgurl = 'http://localhost:3004/images/';
            const result = executereservationcategorysql.map((item) => {
                return {
                    cat_id: item.cat_id,
                    cat_title: item.cat_title,
                    reser_id: item.reser_id,
                    cat_image: firstimgurl + item.cat_image,
                    price_range: item.price_range,
                    cat_status: item.cat_status,
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                };
            });
            objfile['reservation_category_list'] = result;
            Arrayresposne.push(objfile)

            const response = {
                Response: {
                    Success: "1",
                    message: "Success",
                    result: Arrayresposne
                }
            }
            res.send(response)

        } else {
            const response = {
                Response: {
                    Success: "0",
                    message: "No Records!",
                }
            };
            return res.json(response);
        }
    }
    else {
        const response = {
            Response: {
                Success: "0",
                message: "No Records!",
            }
        };
        return res.json(response);
    }
})



app.get("/reservation/subcategory/website/list", async (req, res) => {


    const reser_id = req.query.reser_id;
    const resercat_id = req.query.resercat_id;


    let objfile = {};
    let Arrayresposne = [];



    const sql = `SELECT reser_main_title,cat_title,videos
        FROM reservation
        JOIN reservation_category ON reservation.reser_id = reservation_category.reser_id
        WHERE reservation.status = '1' AND reservation_category.cat_status = '1' AND reservation.reser_id = ${reser_id} AND reservation_category.cat_id=${resercat_id}`

    const executesql = await executeQuery(sql)

    if (executesql.length > 0) {
        const videourl = 'http://localhost:3004/images/';
        objfile['video'] = videourl + executesql[0].videos;
        objfile['reser_title'] = executesql[0].reser_main_title;
        objfile['reser_subtitle'] = executesql[0].cat_title;

        let reservationcategorysql = `select * from reservation_sub_category where status="1" and reser_id=${reser_id} AND reser_cat_id=${resercat_id}`
        const executereservationcategorysql = await executeQuery(reservationcategorysql)

        if (executereservationcategorysql.length > 0) {
            const firstimgurl = 'http://localhost:3004/images/';
            const Arrayimgurl = 'http://localhost:3004/images/';
            const result = executereservationcategorysql.map((item) => {
                const extraImages = JSON.parse(item.sub_extra_img).map(imageName => Arrayimgurl + imageName);
                return {
                    reser_sub_id: item.reser_sub_id,
                    sub_tilte: item.sub_tilte,
                    reser_id: item.reser_id,
                    sub_img: firstimgurl + item.sub_img,
                    reser_id: item.reser_id,
                    reser_cat_id: item.reser_cat_id,
                    sub_extra_img: extraImages,
                    sub_cat_price_range: item.sub_cat_price_range,
                    status: item.status,
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                };
            });
            objfile['reservation_subcategory_list'] = result;
            Arrayresposne.push(objfile)

            const response = {
                Response: {
                    Success: "1",
                    message: "Success",
                    result: Arrayresposne
                }
            }
            res.send(response)

        } else {
            const response = {
                Response: {
                    Success: "0",
                    message: "No Records!",
                }
            };
            return res.json(response);
        }
    }
    else {
        const response = {
            Response: {
                Success: "0",
                message: "No Records!",
            }
        };
        return res.json(response);
    }

})



//admin panel subcategory list api 


app.get("/reservation/subcategory/admin/list", async (req, res) => {
    const reser_sub_id = req.query.reser_sub_id
    let sql;
    if (!reser_sub_id) {
        sql = `select * from reservation_sub_category where status="1"`
    } else {
        sql = `select * from reservation_sub_category where status="1" and reser_sub_id=${reser_sub_id}`
    }
    const exesqlquery = await executeQuery(sql)
    if (exesqlquery.length > 0) {

        const firstimgurl = 'http://localhost:3004/images/';
        const Arrayimgurl = 'http://localhost:3004/images/';

        const result = exesqlquery.map((item) => {
            const extraImages = JSON.parse(item.sub_extra_img).map(imageName => Arrayimgurl + imageName);

            return {
                reser_sub_id: item.reser_sub_id,
                sub_tilte: item.sub_tilte,
                reser_cat_id: item.reser_cat_id,
                reser_id: item.reser_id,
                sub_cat_price_range: item.sub_cat_price_range,
                sub_img: firstimgurl + item.sub_img,
                description: item.description,
                sub_extra_img: extraImages,
                status: item.status,
                created_at: item.created_at,
                updated_at: item.updated_at,
            };
        });
        const response = {
            Response: {
                Success: "1",
                message: "Success",
                result: result
            }
        };
        return res.json(response);
    }
    else {
        const response = {
            Response: {
                Success: "0",
                message: "No Records!",
            }
        };
        return res.json(response);
    }

})




app.post("/video/add/api", async (req, res) => {
    const catid = req.body.cat_id;
    const type = req.body.type;
    if (!catid) {
        return res.json({
            Response: {
                success: '0',
                message: "category Id required!"
            }
        });
    }

    if (!type) {
        return res.json({
            Response: {
                success: '0',
                message: "type required!"
            }
        });
    }

    let videofile;
    if (req.files && req.files.media) {
        try {
            const video = req.files.media;
            const timestamp = Date.now();
            const fileName = `${timestamp}_${video.name}`;
            const imagePath = path.join(__dirname, "video", fileName);
            await video.mv(imagePath); // Move the new image
            videofile = fileName;
        } catch (error) {
            console.error("Error uploading file:", error);
            return res.json({
                Response: {
                    success: '0',
                    message: "Error uploading file."
                }
            });
        }
    }

    const formatdate = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const sql = `INSERT INTO video (video_file, category_id,type, created_at) VALUES (?, ?, ?,?)`;
    con.query(sql, [videofile, catid, type, formatdate], (error, result) => {
        if (error) {
            console.error("Error inserting into database:", error);
            return res.json({
                Response: {
                    success: '0',
                    message: "Error adding video."
                }
            });
        } else {
            return res.json({
                Response: {
                    success: '1',
                    message: "Video added successfully!"
                }
            });
        }
    });
});



//gallery add category api 


app.post("/gallery/category/add", async (req, res) => {
    const gallery_title = req.body.gallery_title;
    const gallery_img = req.files ? req.files.gallery_img : ""

    if (!gallery_title) {
        return res.send({
            success: '0',
            message: "gallery_title required!",
        });
    }
    if (!gallery_img && req.files.gallery_img) {
        return res.send({
            success: '0',
            message: "gallery_img required!",
        });
    }
    const filename = gallery_img.name;
    const fileExtension = filename.split(".").pop().toLowerCase();
    const allowedExtensions = ["jpg", "jpeg", "png"];

    if (!allowedExtensions.includes(fileExtension)) {
        const response = {
            Response: {
                Success: "0",
                Message: "File type not supported.",

            }
        };
        return res.json(response);
    }
    const currentDate = new Date();
    const timestamp = currentDate.getTime();
    const imageUrl = timestamp + "_" + filename;
    console.log(imageUrl)

    const imagePath = path.join(
        __dirname,
        "./", "images",
        imageUrl);

    gallery_img.mv(imagePath, (error) => {
        if (error) {
            const response = {
                Response: {
                    Success: "0",
                    Message: "Error uploading image.",

                }
            };
            return res.json(response)
        }
    })

    const formattedDate = new Date()
    const sql = `INSERT INTO gallery_category (gallery_title,gallery_img,created_at) VALUES (?,?,?)`;

    const sqlValues = [gallery_title, imageUrl, formattedDate];

    con.query(sql, sqlValues, (error, result) => {
        if (error) {
            const response = {
                Response: {
                    Success: "0",
                    Message: "Error inserting data.",

                }
            };
            return res.json(response);
        } else {
            const response = {
                Response: {
                    Success: "1",
                    Message: "gallery Category added successfully!",

                }
            };
            return res.json(response);
        }
    });
})




//gallery list api for admin panel

app.get("/gallery/category/admin/list", async (req, res) => {
    const gallery_id = req.query.gallery_id
    let sql;
    if (!gallery_id) {
        sql = `select * from gallery_category where status="1"`
    } else {
        sql = `select * from gallery_category where status="1" and gallery_id=${reser_sub_id}`
    }
    const exesqlquery = await executeQuery(sql)
    if (exesqlquery.length > 0) {

        const firstimgurl = 'http://localhost:3004/images/';


        const result = exesqlquery.map((item) => {
            return {
                gallery_id: item.gallery_id,
                gallery_title: item.gallery_title,
                gallery_img: (firstimgurl + item.gallery_img),
                status: item.status,
                created_at: item.created_at,
                updated_at: item.updated_at,
            };
        });
        const response = {
            Response: {
                Success: "1",
                message: "Success",
                result: result
            }
        };
        return res.json(response);
    }
    else {
        const response = {
            Response: {
                Success: "0",
                message: "No Records!",
            }
        };
        return res.json(response);
    }

})







//admin panel gallery category update api 

app.post("/gallery/category/update/api", async (req, res) => {
    try {
        const id = req.body.gallery_id;
        if (!id) {
            return res.json({
                success: '0',
                message: "gallery ID required!"
            });
        }

        const sql = `SELECT * FROM gallery_category WHERE status="1" AND gallery_id=${id}`;
        con.query(sql, async (error, result) => {
            if (error) {
                return res.json({
                    success: '0',
                    message: error.message
                });
            } else {
                if (result.length === 0) {
                    return res.json({
                        success: '0',
                        message: "gallery not found."
                    });
                }

                // Extract existing data
                const existingData = result[0];


                const { gallery_title, status } = req.body;
                let gallery_img = existingData.gallery_img;


                if (req.files && req.files.gallery_img) {
                    const reserImg = req.files.gallery_img;
                    const timestamp = Date.now();
                    const fileName = `${timestamp}_${reserImg.name}`;
                    const imagePath = path.join(__dirname, "images", fileName);
                    await reserImg.mv(imagePath); // Move the new image
                    gallery_img = fileName; // Update reser_image with the new filename
                }

                // Check if new data is provided, otherwise use existing data
                const updategallery_title = gallery_title || existingData.gallery_title;

                const updatedstatus = status || existingData.status;

                // Update reservation with new or existing data
                const updateSql = `UPDATE gallery_category SET gallery_title=?, gallery_img=?, status=? WHERE gallery_id=?`;
                con.query(updateSql, [updategallery_title, gallery_img, , updatedstatus, id], (updateError, updateResult) => {
                    if (updateError) {
                        return res.json({
                            success: '0',
                            message: updateError.message
                        });
                    } else {
                        return res.json({
                            success: '1',
                            message: "gallery updated successfully!"
                        });
                    }
                });
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: '0',
            message: error.message,
        });
    }
});



//gallery sub category  add api


app.post("/gallery/subcategory/insert/data", async (req, res) => {
    try {
        const { subgallery_title, gallery_cat_id } = req.body;
        const extra_imgs = req.files ? (Array.isArray(req.files.img) ? req.files.img : [req.files.img]) : [];

        // Validate required fields
        if (!subgallery_title) {
            return res.json({
                success: '0',
                message: "subgallery_title required!",
            });
        }

        const uploadedFiles = await Promise.all(extra_imgs.map(moveImage));

        const imges = JSON.stringify(uploadedFiles);



        const formattedDate = new Date();

        // Insert data into MySQL table
        const sql = `INSERT INTO gallery_subcategory (gallery_sub_title,gallery_cat_id,gallery_sub_img, cretaed_at) VALUES (?, ?,?, ?)`;
        const sqlValues = [subgallery_title, gallery_cat_id, imges, formattedDate];

        con.query(sql, sqlValues, (error, result) => {
            if (error) {
                return res.json({
                    success: '0',
                    message: error.message, // Sending only error message
                });
            } else {
                return res.json({
                    success: '1',
                    message: "gallery subcategory added successfully!",
                });
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: '0',
            message: error.message,
        });
    }
});

async function moveImage(image) {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${image.name}`;
    const imagePath = path.join(__dirname, "images", fileName);

    return new Promise((resolve, reject) => {
        image.mv(imagePath, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve(fileName);
            }
        });
    });
}



//gallery sub category list api 

app.get("/gallery/subcategory/get/list", async (req, res) => {
    const gallery_sub_id = req.query.gallery_cat_id
    let sql;
    if (!gallery_sub_id) {
        sql = `select * from gallery_subcategory where status="1"`
    } else {
        sql = `select * from gallery_subcategory where status="1" and gallery_cat_id=${gallery_sub_id}`
    }
    const exesqlquery = await executeQuery(sql)
    if (exesqlquery.length > 0) {
        const Arrayimgurl = 'http://localhost:3004/images/';

        const result = exesqlquery.map((item) => {
            const extraImages = JSON.parse(item.gallery_sub_img).map(imageName => Arrayimgurl + imageName);

            return {
                gallery_sub_id: item.gallery_sub_id,
                gallery_sub_title: item.gallery_sub_title,
                gallery_cat_id: item.gallery_cat_id,
                gallery_sub_img: extraImages,
                status: item.status,
                created_at: item.created_at,
                updated_at: item.updated_at,
            };
        });
        const response = {
            Response: {
                Success: "1",
                message: "Success",
                result: result
            }
        };
        return res.json(response);
    }
    else {
        const response = {
            Response: {
                Success: "0",
                message: "No Records!",
            }
        };
        return res.json(response);
    }

})

async function executeQuery(query, values) {
    return new Promise((resolve, reject) => {
        con.query(query, values, (error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
}




//menu category add api

app.post("/menu/category/insert/data", async (req, res) => {
    try {
        const { menu_title } = req.body;

        // Validate required fields
        if (!menu_title) {
            return res.send({
                success: '0',
                message: "menu_title required!",
            });
        }

        const formattedDate = new Date();

        // Insert data into MySQL table
        const sql = `INSERT INTO manu_category (menu_title, created_at) VALUES (?, ?)`;
        const sqlValues = [menu_title, formattedDate];

        con.query(sql, sqlValues, (error, result) => {
            if (error) {
                return res.json({
                    success: '0',
                    message: error.message, // Sending only error message
                });
            } else {
                return res.json({
                    success: '1',
                    message: "Menu added!",
                });
            }
        });
    } catch (error) {
        return res.status(200).json({
            success: '0',
            message: error.message,
        });
    }
});




//MENU CATEGORY LIST API WEBSITE AND PANEL

app.get("/menu/category/get/list", async (req, res) => {
    const menu_id = req.query.menu_id
    let sql;
    if (!menu_id) {
        sql = `select * from manu_category where menu_status="1" AND menu_cat_type='C' `
    } else {
        sql = `select * from manu_category where menu_status="1" AND menu_cat_type='C' and menu_id=${menu_id} `
    }
    const exesqlquery = await executeQuery(sql)
    if (exesqlquery.length > 0) {
        const result = exesqlquery.map((item) => {
            return {
                menu_id: item.menu_id,
                menu_title: item.menu_title,
                menu_type: item.menu_type,
                status: item.menu_status,
                created_at: item.created_at,
                updated_at: item.updated_at,
            };
        })

        const response = {
            Response: {
                Success: "1",
                message: "Success",
                result: result
            }
        };
        return res.json(response);
    }
    else {
        const response = {
            Response: {
                Success: "0",
                message: "No Records!",
            }
        };
        return res.json(response);
    }

})





app.post("/menuitem/add", async (req, res) => {
    const { menu_catid, menu_type, menu_titile, menu_price, menu_description, discount, final_price } = req.body;
    const item_img = req.files ? req.files.item_img : ""

    if (!menu_catid) {
        return res.send({
            success: '0',
            message: "menu_catid required!",
        });
    }
    if (!menu_type) {
        return res.send({
            success: '0',
            message: "M FOR menu or C for cake Required!",
        });
    }
    if (!menu_titile) {
        return res.send({
            success: '0',
            message: "menu_titile required!",
        });
    }
    if (!menu_price) {
        return res.send({
            success: '0',
            message: "menu_price required!",
        });
    }
    if (!menu_description) {
        return res.send({
            success: '0',
            message: "menu_description required!",
        });
    }

    if (!item_img && req.files.item_img) {
        return res.send({
            success: '0',
            message: "item_img required!",
        });
    }
    const filename = item_img.name;
    const fileExtension = filename.split(".").pop().toLowerCase();
    const allowedExtensions = ["jpg", "jpeg", "png"];

    if (!allowedExtensions.includes(fileExtension)) {
        const response = {
            Response: {
                Success: "0",
                Message: "File type not supported.",

            }
        };
        return res.json(response);
    }
    const currentDate = new Date();
    const timestamp = currentDate.getTime();
    const imageUrl = timestamp + "_" + filename;
    console.log(imageUrl)

    const imagePath = path.join(
        __dirname,
        "./", "images",
        imageUrl);

    item_img.mv(imagePath, (error) => {
        if (error) {
            const response = {
                Response: {
                    Success: "0",
                    Message: "Error uploading image.",

                }
            };
            return res.json(response)
        }
    })

    const formattedDate = new Date()
    const sql = `INSERT INTO manu_category(menu_title,menu_img,menu_sub_id,menu_type,menu_cat_type,menu_price,menu_final_price,menu_discount,menu_description,created_at)VALUES(?,?,?,?,?,?,?,?,?,?)`;
    let sqlValues;
    if (menu_type == "M") {
        sqlValues = [menu_titile, imageUrl, menu_catid, menu_type, "S", menu_price, final_price, discount, menu_description, formattedDate];
    } else {
        sqlValues = [menu_titile, imageUrl, menu_catid, menu_type, "S", menu_price, final_price, discount, menu_description, formattedDate];
    }


    con.query(sql, sqlValues, (error, result) => {
        if (error) {
            const response = {
                Response: {
                    Success: "0",
                    Message: error,

                }
            };
            return res.json(response);
        } else {
            const response = {
                Response: {
                    Success: "1",
                    Message: "Menu Item Added!",

                }
            };
            return res.json(response);
        }
    });
})




app.get("/menu/item/list", async (req, res) => {
    const menu_cat_id = req.query.menu_cat_id

    // if (!menu_cat_id) {
    //     return res.send({
    //         success: '0',
    //         message: "menu_cat_id required!",
    //     });
    // }


    let sql = `select * from manu_category where menu_status="1" AND menu_type='M' and  menu_cat_type="S"`

    if (menu_cat_id) {
        sql += ` AND menu_sub_id=${menu_cat_id}`
    }
    const exesqlquery = await executeQuery(sql)
    if (exesqlquery.length > 0) {
        const result = exesqlquery.map((item) => {
            return {
                menu_id: item.menu_id,
                menu_title: item.menu_title,
                menu_type: item.menu_type,
                menu_sub_id: item.menu_sub_id,
                menu_cat_type: item.menu_cat_type,
                menu_price: item.menu_price,
                menu_final_price: item.menu_final_price,
                menu_discount: item.menu_discount,
                menu_discount_type: item.menu_discount_type,
                menu_description: item.menu_description,
                menu_status: item.menu_status,
                menu_img: `http://localhost:3004/images/${item.menu_img}`
            };
        })

        const response = {
            Response: {
                Success: "1",
                message: "Success",
                result: result
            }
        };
        return res.json(response);
    }
    else {
        const response = {
            Response: {
                Success: "0",
                message: "No Records!",
            }
        };
        return res.json(response);
    }

})





app.post("/add/to/cart/api", async (req, res) => {
    const { user_id, main_id, main_sub_id, cart_type, denomination, cart_total } = req.body;


    if (!user_id) {
        return res.send({
            success: '0',
            message: "user_id required!",
        });
    }
    if (!main_id) {
        return res.send({
            success: '0',
            message: "main_id Required!",
        });
    }
    if (!main_sub_id) {
        return res.send({
            success: '0',
            message: "main_sub_id required!",
        });
    }
    if (!cart_type) {
        return res.send({
            success: '0',
            message: "M FOR MENU OR C FOR CAKE TYPE REQUIRED!",
        });
    }
    if (!denomination) {
        return res.send({
            success: '0',
            message: "denomination required!",
        });
    }

    if (!cart_total) {
        return res.send({
            success: '0',
            message: "cart_total required!",
        });
    }



    const formattedDate = new Date()
    const sql = `INSERT INTO add_to_cart_menu(cart_user_id,cart_main_id,cart_submain_id,denomination,cart_total,cart_type,created_at)VALUES(?,?,?,?,?,?,?)`;
    let sqlValues;
    if (cart_type == "M") {
        sqlValues = [user_id, main_id, main_sub_id, denomination, cart_total, cart_type, formattedDate];
    } else {
        sqlValues = [user_id, main_id, main_sub_id, denomination, cart_total, cart_type, formattedDate];
    }


    con.query(sql, sqlValues, (error, result) => {
        if (error) {
            const response = {
                Response: {
                    Success: "0",
                    Message: error,

                }
            };
            return res.json(response);
        } else {
            const response = {
                Response: {
                    Success: "1",
                    Message: "Added!",

                }
            };
            return res.json(response);
        }
    });
})



app.post("/add/to/cart/update/api", async (req, res) => {
    const { user_id, main_id, main_sub_id, cart_type, denomination, cart_total, cart_id } = req.body;

    if (!cart_id) {
        return res.send({
            success: '0',
            message: "cart_id required!",
        });
    }

    const checksql = `select * from add_to_cart_menu where menu_booking_order_status="W" AND cart_status="1" AND cart_id=${cart_id}`
    const executecheckquery = await executeQuery(checksql)
    if (executecheckquery.length > 0) {

        if (!main_id) {
            return res.send({
                success: '0',
                message: "main_id Required!",
            });
        }
        if (!main_sub_id) {
            return res.send({
                success: '0',
                message: "main_sub_id required!",
            });
        }
        if (!cart_type) {
            return res.send({
                success: '0',
                message: "M FOR MENU OR C FOR CAKE TYPE REQUIRED!",
            });
        }
        if (!denomination) {
            return res.send({
                success: '0',
                message: "denomination required!",
            });
        }

        if (!cart_total) {
            return res.send({
                success: '0',
                message: "cart_total required!",
            });
        }

        const sql = `update add_to_cart_menu  set cart_user_id =?,cart_main_id=?,cart_submain_id=? ,denomination=?,cart_total=?,cart_type=? where cart_status="1" AND menu_booking_order_status="W" and cart_id=?`;
        let sqlValues;
        if (cart_type == "M") {
            sqlValues = [user_id, main_id, main_sub_id, denomination, cart_total, cart_type, cart_id];
        } else {
            sqlValues = [user_id, main_id, main_sub_id, denomination, cart_total, cart_type, cart_id];
        }


        con.query(sql, sqlValues, (error, result) => {
            if (error) {
                const response = {
                    Response: {
                        Success: "0",
                        Message: error,

                    }
                };
                return res.json(response);
            } else {
                const response = {
                    Response: {
                        Success: "1",
                        Message: "Added!",

                    }
                };
                return res.json(response);
            }
        });

    } else {

        return res.send({
            success: '0',
            message: "Item Not Found",
        });
    }




})


app.post("/add/to/cart/remove/api", async (req, res) => {
    const { cart_id, main_id, main_sub_id, } = req.body;

    if (!cart_id) {
        return res.send({
            success: '0',
            message: "cart_id required!",
        });
    }

    const checksql = `select * from add_to_cart_menu where menu_booking_order_status="W" AND cart_status="1" AND cart_id=${cart_id}`
    const executecheckquery = await executeQuery(checksql)
    if (executecheckquery.length > 0) {

        if (!main_id) {
            return res.send({
                success: '0',
                message: "main_id Required!",
            });
        }
        if (!main_sub_id) {
            return res.send({
                success: '0',
                message: "main_sub_id required!",
            });
        }

        const sql = `delete  from add_to_cart_menu   where cart_status="1" AND menu_booking_order_status="W" and cart_id=? AND cart_main_id=? AND cart_submain_id=?`;
        let sqlValues = [cart_id, main_id, main_sub_id];

        con.query(sql, sqlValues, (error, result) => {
            if (error) {
                const response = {
                    Response: {
                        Success: "0",
                        Message: error,

                    }
                };
                return res.json(response);
            } else {
                const response = {
                    Response: {
                        Success: "1",
                        Message: "Your Cart Removed!",

                    }
                };
                return res.json(response);
            }
        });

    } else {

        return res.send({
            success: '0',
            message: "Item Not Found",
        });
    }




})



// =============================================================


app.post("/booking/api", async (req, res) => {
    const { user_id, order_type, order_date, order_time, usernumber, bill_amt, address, state, pincode, city, bill_charge, final_amt } = req.body;

    const cartids = req.body.cartids ? JSON.parse(req.body.cartids) : []
    if (!order_type) {
        return res.send({
            success: '0',
            message: "P for Pickup or O for Online Delivery",
        });
    }
    if ((order_type == "P") && (!order_date || !order_time || !usernumber || !bill_amt || !cartids || !user_id)) {
        return res.send({
            success: '0',
            message: "Please Provide Pickup Details!",
        });
    }
    if ((order_type == "O") && (!address || !state || !usernumber || !pincode || !city || !bill_charge || !final_amt || !bill_amt || !user_id)) {
        return res.send({
            success: '0',
            message: "Please Provide Order Details!",
        });
    }
    if (Array.isArray(cartids) && cartids.length > 0) {

        const queryCart = (row) => {
            return new Promise((resolve, reject) => {
                const sql = `SELECT count(*) as count FROM add_to_cart_menu where cart_id=${row}  AND menu_booking_order_status="W" AND cart_status="1"`;
                con.query(sql, (err, res) => {
                    const rowCount = res[0].count;
                    resolve(rowCount == 1);
                });
            });
        };
        (async () => {
            let cartcount = 0;
            for (const row of cartids) {
                const isCountValid = await queryCart(row);
                if (isCountValid) {
                    cartcount++;
                }
            }
            if (cartcount == cartids.length) {

                const formattedDate = new Date();
                const cartidJSON = JSON.stringify(cartids);
                let sql;
                let values;
                if (order_type === "P") {
                    const date = new Date(order_date);
                    const formattedDate = date.toISOString().split('T')[0];
                    sql = `insert into  booking_order_cart(booking_order_user_id,booking_order_type,booking_order_date,booking_order_time,booking_contact_number,booking_order_billing_amt,
                    booking_order_cart_ids,booking_order_created_at) values(?,?,?,?,?,?,?,?)`
                    values = [user_id, order_type, date, order_time, usernumber, bill_amt, cartidJSON, formattedDate]
                }
                else if (order_type === "O") {
                    sql = `insert into booking_order_cart(booking_order_user_id,booking_order_type,booking_order_address,booking_order_city,booking_order_state,booking_order_pincode,booking_contact_number,booking_order_billing_amt,booking_order_cart_ids,booking_order_billing_charge,booking_order_final_amt,booking_order_created_at) values(?,?,?,?,?,?,?,?,?,?,?,?)`;
                    values = [user_id, order_type, address, city, state, pincode, usernumber, bill_amt, cartidJSON, bill_charge, final_amt, formattedDate]
                }
                con.query(sql, values, (error, result) => {

                    if (error) {
                        res.send(error);
                    }

                    else {
                        const queryCartupdate = (row) => {
                            return new Promise((resolve, reject) => {
                                const sqlquery = `UPDATE add_to_cart_menu SET menu_booking_order_status="B" WHERE cart_id=? AND menu_booking_order_status="W" AND cart_status="1"`;
                                con.query(sqlquery, [row], (err, result) => {

                                    resolve(result);
                                });
                            });
                        };

                        (async () => {
                            for (const row of cartids) {
                                await queryCartupdate(row);
                            }
                            const response = {
                                Response: {
                                    Success: "1",
                                    Message: "Booking Successfully !",
                                },
                            };
                            res.json(response);
                        })();
                    }
                })
            } else {
                const response = {
                    Response: {
                        Success: "0",
                        Message: "Please Provide Valid Cart Details",
                    },
                };
                res.json(response);
            }
        }
        )
    }
})



app.post("/payment/status", async (req, res) => {
    const costid = req.query.costid;
    const payment = req.query.pstatus;
    const orderid = req.query.rid;
    if (!costid || costid <= 0) {
        const response = {
            Response: {
                Success: "0",
                message: "Please Provide a Valid Id greater than 0!"
            }
        };
        return res.send(response);
    }

    if (!orderid) {
        const response = {
            Response: {
                Success: "0",
                message: "Please Provide Order Id!"
            }
        };
        return res.send(response);
    }

    if (payment === null || (payment !== '1')) {
        const response = {
            Response: {
                Success: "0",
                message: "Please Provide payment Status 0 or 1"
            }
        };
        return res.send(response);
    }

    const sql = `SELECT * FROM booking_order_cart WHERE  booking_order_status="1" AND booking_order_id=${orderid}`;

    con.query(sql, (error, result) => {
        if (error) {
            return res.send(error);
        }

        if (result.length === 0) {
            const response = {
                Response: {
                    Success: "0",
                    message: "Invalid Order Id"
                }
            };
            return res.json(response);
        }
        const tableStatus = result[0].booking_order_payment_status;
        console.log("tableStatus", tableStatus)
        if (tableStatus != "1") {
            const sql2 = `UPDATE booking_order_cart SET booking_order_payment_status=? WHERE booking_order_id
        =${orderid}`;
            con.query(sql2, [payment], (Error, result) => {
                if (Error) {
                    const response = {
                        Response: {
                            Success: "0",
                            message: "Failed to Added!"
                        }
                    };
                    return res.json(response);
                } else {
                    const response = {
                        Response: {
                            Success: "1",
                            message: "Successfully Added"
                        }
                    };
                    return res.json(response);
                }
            });
        } else {
            const response = {
                Response: {
                    Success: "0",
                    message: "already Added!"
                }
            };
            return res.json(response);
        }
    });
})



app.post("/delivery/status", async (req, res) => {
    const delivery_status = req.body.delivery_status;
    const orderid = req.body.rid;
    if (!orderid) {
        const response = {
            Response: {
                Success: "0",
                message: "Please Provide Order Id!"
            }
        };
        return res.send(response);
    }

    if (!delivery_status) {
        const response = {
            Response: {
                Success: "0",
                message: "Please Provide delivery_status 1"
            }
        };
        return res.send(response);
    }
    const sql = `SELECT * FROM booking_order_cart WHERE  booking_order_status="1" AND booking_order_id=${orderid}`;
    con.query(sql, (error, result) => {
        if (error) {
            return res.send(error);
        }

        if (result.length === 0) {
            const response = {
                Response: {
                    Success: "0",
                    message: "Invalid Order Id"
                }
            };
            return res.json(response);
        }
        const tableStatus = result[0].booking_order_delivery_status;
        console.log("tableStatus", tableStatus)
        if (tableStatus != "1") {
            const sql2 = `UPDATE booking_order_cart SET booking_order_delivery_status=? WHERE booking_order_id
        =${orderid}`;
            con.query(sql2, [payment], (Error, result) => {
                if (Error) {
                    const response = {
                        Response: {
                            Success: "0",
                            message: "Failed to Added!"
                        }
                    };
                    return res.json(response);
                } else {
                    const response = {
                        Response: {
                            Success: "1",
                            message: "Delivery Success!"
                        }
                    };
                    return res.json(response);
                }
            });
        } else {
            const response = {
                Response: {
                    Success: "0",
                    message: "already Delivery!"
                }
            };
            return res.json(response);
        }
    });



})


//BOOKING MONTH FORMAT

app.get("/booking/order/list", async (req, res) => {
    try {
        const { month, year, status } = req.query;

        if (!month || !year || !status) {
            const response = {
                Response: {
                    Success: "1",
                    message: "Please provide all details (month, year, status)."
                }
            };
            return res.json(response);
        }

        const sql = `
            SELECT cbo.*, u.name 
            FROM booking_order_cart cbo 
            JOIN users u ON cbo.booking_order_user_id = u.id 
            WHERE cbo.booking_order_status = 1 
            AND cbo.booking_order_approval_status = ? 
            AND MONTH(cbo.booking_order_created_at) = ? 
            AND YEAR(cbo.booking_order_created_at) = ? 
            ORDER BY cbo.booking_order_created_at DESC`;

        con.query(sql, [status, month, year], async (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }

            if (result.length === 0) {

                const response = {
                    Response: {
                        Success: "0",
                        Message: "Order not found",
                    }
                };
                return res.json(response);
            }

            // Fetch cart details for each order
            const ordersWithCartDetails = await Promise.all(result.map(async (item) => {
                const cartids = JSON.parse(item.booking_order_cart_ids);
                const cartquery = `
                    SELECT * 
                    FROM add_to_cart_menu 
                    WHERE cart_status = 1 
                    AND cart_user_id = ? 
                    AND cart_id IN (?)`;
                const cartDetails = await new Promise((resolve, reject) => {
                    con.query(cartquery, [item.booking_order_user_id, cartids], (error, cartResult) => {
                        if (error) reject(error);
                        resolve(cartResult);
                    });
                });

                // Fetch additional details for each menu item in the cart
                const cartDetailsWithAdditionalInfo = await Promise.all(cartDetails.map(async (cartItem) => {
                    const menuDetailsQuery = `SELECT menu_title, menu_img, menu_price, menu_type, menu_description, menu_discount, menu_final_price  FROM manu_category WHERE menu_type="M" AND menu_id = ?`;
                    const menuDetails = await new Promise((resolve, reject) => {
                        console.log(cartItem.cart_submain_id)
                        con.query(menuDetailsQuery, [cartItem.cart_submain_id], (error, menuResult) => {
                            if (error) reject(error);
                            if (menuResult && menuResult.length > 0) {
                                resolve(menuResult[0]);
                            } else {
                                reject(new Error('Menu details not found'));
                            }
                        });
                    });
                    return { ...cartItem, ...menuDetails };
                }));

                return { ...item, cartDetails: cartDetailsWithAdditionalInfo };
            }));

            const response = {
                Response: {
                    Success: "1",
                    Message: "Success",
                    Result: ordersWithCartDetails
                }
            };
            return res.json(response);


        });
    } catch (error) {
        console.error(error);
        return res.status(200).json({ success: false, error: 'Internal server error' });
    }
});


//BOOKING DATE FORMAT

app.get("/booking/order/list1", async (req, res) => {
    try {
        const { startDate, endDate, status } = req.query;

        if (!startDate || !endDate || !status) {
            const response = {
                Response: {
                    Success: "1",
                    message: "Please provide all details (fromdate, lastdate, status)."
                }
            };
            return res.json(response);
        }

        let query = `SELECT * FROM booking_order_cart WHERE 1=1`;

        if (status && startDate && endDate) {
            endDate = new Date(new Date(endDate).setHours(23, 59, 59, 999)).toISOString();
            query += ` AND booking_order_approval_status='${status}' AND (booking_order_created_at>='${startDate}' AND booking_order_created_at<='${endDate}') ORDER BY booking_order_created_at DESC`;
        } else if (startDate && endDate) {
            endDate = new Date(new Date(endDate).setHours(23, 59, 59, 999)).toISOString();
            query += ` AND (booking_order_created_at>='${startDate}' AND booking_order_created_at<='${endDate}') ORDER BY booking_order_created_at DESC`;
        }


        con.query(query, [status, month, year], async (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }

            if (result.length === 0) {

                const response = {
                    Response: {
                        Success: "0",
                        Message: "Order not found",
                    }
                };
                return res.json(response);
            }

            // Fetch cart details for each order
            const ordersWithCartDetails = await Promise.all(result.map(async (item) => {
                const cartids = JSON.parse(item.booking_order_cart_ids);
                const cartquery = `
                    SELECT * 
                    FROM add_to_cart_menu 
                    WHERE cart_status = 1 
                    AND cart_user_id = ? 
                    AND cart_id IN (?)`;
                const cartDetails = await new Promise((resolve, reject) => {
                    con.query(cartquery, [item.booking_order_user_id, cartids], (error, cartResult) => {
                        if (error) reject(error);
                        resolve(cartResult);
                    });
                });

                // Fetch additional details for each menu item in the cart
                const cartDetailsWithAdditionalInfo = await Promise.all(cartDetails.map(async (cartItem) => {
                    const menuDetailsQuery = `SELECT menu_title, menu_img, menu_price, menu_type, menu_description, menu_discount, menu_final_price  FROM manu_category WHERE menu_type="M" AND menu_id = ?`;
                    const menuDetails = await new Promise((resolve, reject) => {
                        console.log(cartItem.cart_submain_id)
                        con.query(menuDetailsQuery, [cartItem.cart_submain_id], (error, menuResult) => {
                            if (error) reject(error);
                            if (menuResult && menuResult.length > 0) {
                                resolve(menuResult[0]);
                            } else {
                                reject(new Error('Menu details not found'));
                            }
                        });
                    });
                    return { ...cartItem, ...menuDetails };
                }));

                return { ...item, cartDetails: cartDetailsWithAdditionalInfo };
            }));

            const response = {
                Response: {
                    Success: "1",
                    Message: "Success",
                    Result: ordersWithCartDetails
                }
            };
            return res.json(response);


        });
    } catch (error) {
        console.error(error);
        return res.status(200).json({ success: false, error: 'Internal server error' });
    }
});



app.get("/cart/list/api", async (req, res) => {

    const userid = req.query.userid;

    if (userid) {
        const userquery = `select * from users where status="1" AND  id=${userid}`
        const checkquery = await executeQuery(userquery);
        if (checkquery.length != 1) {
            const response = {
                Response: {
                    Success: "0",
                    message: "Not Vaild User!"
                }
            };
            return res.json(response);
        }
    }


    let catlogquery = `select * from add_to_cart_menu where cart_status="1" AND menu_booking_order_status="W"  AND cart_user_id=${userid}`
    const checkquery2 = await executeQuery(catlogquery);

    let promises = checkquery2.map((row) => {
        const baseUrl = 'http://localhost:3004/images/'
        return new Promise((resolve, reject) => {

            console.log();

            const sql1 = `SELECT menu_title AS menu_stitle,CONCAT('${baseUrl}', menu_img) AS image_url ,menu_type,menu_price,menu_final_price,menu_discount,menu_description FROM manu_category   where  menu_cat_type="S" and menu_id=${row.cart_submain_id};`;
            con.query(sql1, (error, result1) => {
                if (error) {
                    reject(error);
                } else {
                    if (result1 && result1.length > 0) {
                        row.cat = result1[0];
                    }
                    resolve(row);
                }
            });
        })
            .then((row) => {
                return new Promise((resolve, reject) => {
                    const sql2 = `SELECT menu_title  FROM manu_category  where menu_cat_type="C" and menu_id=${row.cart_main_id};`;
                    con.query(sql2, (error, result2) => {
                        if (error) {
                            reject(error);
                        } else {
                            if (result2 && result2.length > 0) {
                                row.item = result2[0];
                            }
                            resolve(row);
                        }
                    });
                });
            })

    });

    const rows = await Promise.all(promises);
    rows.forEach((row) => {
        row.cat = row.cat || {};
        row.item = row.item || {};
        Object.assign(row, row.cat, row.item);
        delete row.cat;
        delete row.item;
    });

    if (checkquery2.length > 0) {
        const sql = `select  sum(cart_total) as all_item_tot from add_to_cart_menu where cart_status="1" AND menu_booking_order_status="W"  AND cart_user_id=${userid}`
        con.query(sql, (err, result) => {
            if (err) {
                console.log(err);
            } else {
                // console.log(result);
                const response = {
                    Response: {
                        Success: "1",
                        message: "Success",
                        Result: rows,
                        all_item_tot: result[0].all_item_tot

                    }
                };
                return res.json(response);
            }
        })

    } else {
        const response = {
            Response: {
                Success: "0",
                Message: "No Records!",

            }
        };
        return res.json(response);
    }

})


//CAKE CATEGORY ADD API

app.post("/cake/category/add", async (req, res) => {
    const cake_title = req.body.cake_title;
    const cake_img = req.files ? req.files.cake_img : ""

    if (!cake_title) {
        return res.send({
            success: '0',
            message: "cake_title required!",
        });
    }
    if (!cake_img && req.files.cake_img) {
        return res.send({
            success: '0',
            message: "cake_img required!",
        });
    }
    const filename = cake_img.name;
    const fileExtension = filename.split(".").pop().toLowerCase();
    const allowedExtensions = ["jpg", "jpeg", "png"];

    if (!allowedExtensions.includes(fileExtension)) {
        const response = {
            Response: {
                Success: "0",
                Message: "File type not supported.",

            }
        };
        return res.json(response);
    }
    const currentDate = new Date();
    const timestamp = currentDate.getTime();
    const imageUrl = timestamp + "_" + filename;
    console.log(imageUrl)

    const imagePath = path.join(
        __dirname,
        "./", "images",
        imageUrl);

    cake_img.mv(imagePath, (error) => {
        if (error) {
            const response = {
                Response: {
                    Success: "0",
                    Message: "Error uploading image.",

                }
            };
            return res.json(response)
        }
    })

    const formattedDate = new Date()
    const sql = `INSERT INTO manu_category (menu_title,menu_img,menu_type,created_at) VALUES (?,?,?,?)`;

    const sqlValues = [cake_title, imageUrl, "C", formattedDate];

    con.query(sql, sqlValues, (error, result) => {
        if (error) {
            const response = {
                Response: {
                    Success: "0",
                    Message: "Error inserting data.",

                }
            };
            return res.json(response);
        } else {
            const response = {
                Response: {
                    Success: "1",
                    Message: "Cake Category added successfully!",

                }
            };
            return res.json(response);
        }
    });
})

app.get("/cake/category/get/list", async (req, res) => {
    const cat_id = req.query.cat_id
    let sql;
    if (!cat_id) {
        sql = `select * from manu_category where menu_status="1"  AND menu_type="C" AND menu_cat_type="C"`
    } else {
        sql = `select * from manu_category where menu_status="1" AND menu_type="C" AND menu_cat_type="C"  and menu_id='${cat_id}'`
    }
    const exesqlquery = await executeQuery(sql)
    if (exesqlquery.length > 0) {
        const imgurl = 'http://localhost:3004/images/';

        const result = exesqlquery.map((item) => {

            return {
                cake_id: item.menu_id,
                cake_title: item.menu_title,
                cake_img: (imgurl + item.menu_img),
                menu_type: item.menu_type,
                menu_status: item.menu_status,
                created_at: item.created_at,
                updated_at: item.updated_at,
            };
        });
        const response = {
            Response: {
                Success: "1",
                message: "Success",
                result: result
            }
        };
        return res.json(response);
    }
    else {
        const response = {
            Response: {
                Success: "0",
                message: "No Records!",
            }
        };
        return res.json(response);
    }

})



app.get("/cake/subcategory/get/list", async (req, res) => {
    const cake_cat_id = req.query.cake_cat_id;

    if (!cake_cat_id) {
        return res.status(200).json({
            success: '0',
            message: "cake_cat_id is required!",
        });
    }

    try {
        const response = {};
        const baseUrl = 'http://localhost:3004/images/';

        // Fetch main cake category details
        let sql = `SELECT * FROM manu_category WHERE menu_status="1" AND menu_type="C" AND menu_cat_type="C" AND menu_id=${cake_cat_id}`;
        const mainCategoryResult = await executeQuery(sql);

        if (mainCategoryResult.length > 0) {
            response.cake_category_name = mainCategoryResult[0].menu_title;
            const sub_id = mainCategoryResult[0].menu_id;

            // Fetch cake subcategories
            let cakesubsql = `SELECT menu_id, menu_title, CONCAT('${baseUrl}', menu_img) AS image_url, menu_sub_id, menu_type, menu_cat_type, menu_price, menu_final_price, menu_discount, menu_description, menu_status FROM manu_category WHERE menu_status="1" AND menu_type="C" AND menu_cat_type="S" AND menu_sub_id=${sub_id}`;
            const subCategoryResult = await executeQuery(cakesubsql);

            response.subcategories = subCategoryResult.map(item => ({
                menu_title: item.menu_title,
                menu_sub_id: item.menu_sub_id,
                menu_id: item.menu_id,
                image_url: item.image_url,
                menu_price: item.menu_price,
                menu_final_price: item.menu_final_price,
                menu_discount: item.menu_discount,
                menu_description: item.menu_description,
                menu_status: item.menu_status
            }));

            return res.send({
                Response: {
                    Success: "1",
                    message: "Success",
                    result: response
                }
            });
        } else {
            return res.send({
                Response: {
                    Success: "0",
                    message: "No Records Found!",
                }
            });
        }
    } catch (error) {
        console.error("Error:", error);
        return res.status(200).json({
            success: '0',
            message: "Internal Server Error",
        });
    }
});


app.get("/cake/subcategory/get/list/panel", async (req, res) => {

    try {
        const response = {};
        const baseUrl = 'http://localhost:3004/images/';

        // Fetch main cake category details
        let sql = `SELECT * FROM manu_category WHERE menu_status="1" AND menu_type="C" AND menu_cat_type="C"`;
        const mainCategoryResult = await executeQuery(sql);

        if (mainCategoryResult.length > 0) {
            response.cake_category_name = mainCategoryResult[0].menu_title;
            const sub_id = mainCategoryResult[0].menu_id;

            // Fetch cake subcategories
            let cakesubsql = `SELECT menu_id, menu_title, CONCAT('${baseUrl}', menu_img) AS image_url, menu_sub_id, menu_type, menu_cat_type, menu_price, menu_final_price, menu_discount, menu_description, menu_status FROM manu_category WHERE menu_status="1" AND menu_type="C" AND menu_cat_type="S" AND menu_sub_id=${sub_id}`;
            const subCategoryResult = await executeQuery(cakesubsql);

            response.subcategories = subCategoryResult.map(item => ({
                menu_title: item.menu_title,
                menu_sub_id: item.menu_sub_id,
                menu_id: item.menu_id,
                image_url: item.image_url,
                menu_price: item.menu_price,
                menu_final_price: item.menu_final_price,
                menu_discount: item.menu_discount,
                menu_description: item.menu_description,
                menu_status: item.menu_status
            }));

            return res.send({
                Response: {
                    Success: "1",
                    message: "Success",
                    result: response
                }
            });
        } else {
            return res.send({
                Response: {
                    Success: "0",
                    message: "No Records Found!",
                }
            });
        }
    } catch (error) {
        console.error("Error:", error);
        return res.status(200).json({
            success: '0',
            message: "Internal Server Error",
        });
    }
});

app.get("/waiting/candle/light/dinner", async (req, res) => {
    let fromdate = req.query.fromdate;
    let todate = req.query.todate;
    if (!fromdate || !todate) {
        return res.send({
            Response: {
                success: '0',
                message: "Please provide fromdate and Todate!",
            }
        });
    }


    const fromDateParts = fromdate.split('/');
    const fromDateWithTime = `${fromDateParts[0]} 00:00:00`;
    const toDateParts = todate.split('/');
    const toDateWithTime = `${toDateParts[0]} 23:59:59`;


    let sql = ` SELECT booking_id, reservation_id,reservation_catid,reservation_sub_catid,reservation_type,user_id,date,time,total_people,menu_type,approval_status,payment_status,booking_status,status,created_at FROM reservation_booking where booking_status="W" AND  payment_status="0" AND reservation_type="CL" AND  (created_at>='${fromDateWithTime}' AND created_at<='${toDateWithTime}') ORDER BY created_at DESC`;
    const result = await new Promise((resolve, reject) => {
        con.query(sql, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
    console.log(result)

    let promises = result.map(async (row) => {
        return new Promise((resolve, reject) => {
            const sql1 = ` SELECT  cat_title FROM reservation_category WHERE cat_id = ${row.reservation_catid}`;
            con.query(sql1, (error, result1) => {
                if (error) {
                    reject(error);
                } else {
                    if (result1 && result1.length > 0) {
                        row.user = result1[0];
                    }
                    resolve(row);
                }
            });
        })
            .then((row) => {
                return new Promise((resolve, reject) => {
                    const sql2 = `SELECT sub_tilte,sub_cat_price_range  FROM reservation_sub_category WHERE reser_sub_id = ${row.reservation_sub_catid}`;
                    con.query(sql2, (error, result2) => {
                        if (error) {
                            reject(error);
                        } else {
                            if (result2 && result2.length > 0) {
                                row.vendor = result2[0];
                            }
                            resolve(row);
                        }
                    });
                })
            }).then((row) => {
                return new Promise((resolve, reject) => {
                    const sql2 = `SELECT name as user_name,mobile as user_mobile  FROM users WHERE id = ${row.user_id}`;
                    con.query(sql2, (error, result2) => {
                        if (error) {
                            reject(error);
                        } else {
                            if (result2 && result2.length > 0) {
                                row.reser = result2[0];
                            }
                            resolve(row);
                        }
                    });
                })
            })

    });


    const rows = await Promise.all(promises);

    rows.forEach((row) => {

        row.user = row.user || {};
        row.vendor = row.vendor || {};
        row.reser = row.reser || {};
        Object.assign(row, row.user, row.vendor, row.reser);
        delete row.user;
        delete row.vendor;
        delete row.reser;
    });

    if (rows.length > 0) {
        const response = {
            Response: {
                Success: "1",
                Message: "Success",
                Result: rows
            }
        };
        return res.json(response);
    } else {
        const response = {
            Response: {
                Success: "0",
                Message: "NO Records",
            }
        };
        return res.json(response)
    }
})

app.get("/payment/candle/light/dinner", async (req, res) => {
    let fromdate = req.query.fromdate;
    let todate = req.query.todate;
    if (!fromdate || !todate) {
        return res.send({
            Response: {
                success: '0',
                message: "Please provide fromdate and Todate!",
            }
        });
    }


    const fromDateParts = fromdate.split('/');
    const fromDateWithTime = `${fromDateParts[0]} 00:00:00;`
    const toDateParts = todate.split('/');
    const toDateWithTime = `${toDateParts[0]} 23:59:59`;


    let sql = `SELECT booking_id,reservation_id,reservation_catid,reservation_sub_catid,reservation_type,user_id,date,time,total_people,menu_type,approval_status,payment_status,booking_status,status,created_at,updated_at FROM reservation_booking where payment_status="1" AND approval_status="1" AND booking_status="B" AND reservation_type="CL" AND  (created_at>='${fromDateWithTime}' AND created_at<='${toDateWithTime}') ORDER BY created_at DESC`;
    const result = await new Promise((resolve, reject) => {
        con.query(sql, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });


    let promises = result.map(async (row) => {
        return new Promise((resolve, reject) => {
            const sql1 = `SELECT  cat_title FROM reservation_category WHERE cat_id = ${row.reservation_catid}`;
            con.query(sql1, (error, result1) => {
                if (error) {
                    reject(error);
                } else {
                    if (result1 && result1.length > 0) {
                        row.user = result1[0];
                    }
                    resolve(row);
                }
            });
        })
            .then((row) => {
                return new Promise((resolve, reject) => {
                    const sql2 = `SELECT sub_tilte,sub_cat_price_range  FROM reservation_sub_category WHERE reser_sub_id = ${row.reservation_sub_catid}`;
                    con.query(sql2, (error, result2) => {
                        if (error) {
                            reject(error);
                        } else {
                            if (result2 && result2.length > 0) {
                                row.vendor = result2[0];
                            }
                            resolve(row);
                        }
                    });
                })
            }).then((row) => {
                return new Promise((resolve, reject) => {
                    const sql2 = `SELECT name as user_name,mobile as user_mobile  FROM users WHERE id = ${row.user_id}`;
                    con.query(sql2, (error, result2) => {
                        if (error) {
                            reject(error);
                        } else {
                            if (result2 && result2.length > 0) {
                                row.reser = result2[0];
                            }
                            resolve(row);
                        }
                    });
                })
            })

    });


    const rows = await Promise.all(promises);

    rows.forEach((row) => {

        row.user = row.user || {};
        row.vendor = row.vendor || {};
        row.reser = row.reser || {};
        Object.assign(row, row.user, row.vendor, row.reser);
        delete row.user;
        delete row.vendor;
        delete row.reser;
    });

    if (rows.length > 0) {
        const response = {
            Response: {
                Success: "1",
                Message: "Success",
                Result: rows
            }
        };
        return res.json(response);
    } else {
        const response = {
            Response: {
                Success: "0",
                Message: "NO Records",
            }
        };
        return res.json(response)
    }
})





// ------------------------------------------------------------------reservation booking api

app.post("/reservationbooking/api", async (req, res) => {
    const { userid, reser_id, reser_catid, resersubcatid, type, menu_type, date, time, peoples, photohanging, photoshoot, bouquet, firecracks, decription, balloon, cake_weight, cake_decription, flaver, party_amt, cake_shape } = req.body;
  
    console.log("Received booking request:", req.body);
  
    if (!userid) {
      return res.send({
        Response: {
          success: '0',
          message: "User Id is required!",
        }
      });
    }
  
    const checkUserQuery = `SELECT * FROM users WHERE id = ?`;
    const userResult = await executeQuery(checkUserQuery, [userid]);
    
    if (userResult.length > 0) {
      if (type === "CL" || type === "BP" || type === "TA") {
        if (type === "CL" && (!date || !time || !peoples || !menu_type || !reser_id || !reser_catid || !resersubcatid)) {
          return res.json({
            Response: {
              Success: "0",
              Message: "Please Provide Valid candle light dinner Details",
            }
          });
        }
  
        if (type === "BP" && (!date || !time || !peoples || !photohanging || !photoshoot || !bouquet || !firecracks || !decription || !reser_id || !reser_catid || !resersubcatid || !flaver)) {
          return res.json({
            Response: {
              Success: "0",
              Message: "Please Provide Valid birthday party Details",
            }
          });
        }
  
        if (type === "TA" && (!date || !time || !peoples || !reser_id || !reser_catid || !resersubcatid)) {
          return res.json({
            Response: {
              Success: "0",
              Message: "Please Provide Valid table booking Details",
            }
          });
        }
  
        let formatDate = new Date();
        if (type === "CL") {
          const insertCandleLightDinnerQuery = `INSERT INTO reservation_booking (reservation_id,reservation_catid,reservation_sub_catid,user_id,reservation_type,date, time,total_people, menu_type,created_at) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          const sqlValues = [
            reser_id,
            reser_catid, 
            resersubcatid, 
            userid, 
            type, 
            date, 
            time, 
            peoples, 
            menu_type, 
            formatDate
          ];
          
          con.query(insertCandleLightDinnerQuery, sqlValues, async(error, result) => {
            if (error) {
              console.log(error)
              return res.json({
                Response: {
                  Success: "0",
                  Message: "Booking failed"
                }
              });
            } else {
              const reservationId = result.insertId; 
              await mailbooking(reservationId,res)
              return res.json({
                Response: {
                  Success: "1",
                  Message: "Booked!",
                  ReservationId: reservationId
                  
  
                }
              });
            }
          });
        } else if (type === "BP") {
          const getValidNumber = (value) => {
            return isNaN(Number(value)) ? 0 : Number(value);
          };
          const final_amt = getValidNumber(photohanging) + getValidNumber(photoshoot) + getValidNumber(bouquet) + getValidNumber(firecracks) + getValidNumber(party_amt);
          console.log("final_amt",final_amt)
          const insertBirthdayQuery = `INSERT INTO reservation_booking (reservation_id, reservation_catid, reservation_sub_catid, user_id,reservation_type, date, time, total_people, photo_hanging, photo_shoot, bouquet, fire_crackers, balloon, cake_shape, cake_weight, cake_decription,description, flavour, final_amt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          const sqlValues = [
            reser_id, reser_catid, resersubcatid, userid, type, date, time, peoples, 
            photohanging, photoshoot, bouquet, firecracks, balloon, cake_shape, 
            cake_weight, cake_decription, decription, flaver, final_amt, formatDate
          ];
          con.query(insertBirthdayQuery, sqlValues,async (error, result) => {
            if (error) {
              console.log(error)
              return res.json({
                Response: {
                  Success: "0",
                  Message: "Booking failed"
                }
              });
            } else {
              const reservationId = result.insertId; 
              await  birthdaymailbooking(reservationId)
              return res.json({
                Response: {
                  Success: "1",
                  Message: "Booked!"
                }
              });
            }
          });
        } else if (type === "TA") {
          const insertTableBookingQuery = `
            INSERT INTO reservation_booking (
              reservation_id, reservation_catid, reservation_sub_catid, user_id, 
              reservation_type, date, time, total_people, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          const sqlValues = [
            reser_id, reser_catid, resersubcatid, userid, type, date, time, peoples, formatDate
          ];
  
          con.query(insertTableBookingQuery, sqlValues, async(error, result) => {
            if (error) {
              return res.json({
                Response: {
                  Success: "0",
                  Message: "Booking failed"
                }
              });
            } else {
              const reservationId = result.insertId; 
              await mailbooking(reservationId)
              return res.json({
                Response: {
                  Success: "1",
                  Message: "Booked!"
                }
              });
            }
          });
        }
      } else {
        return res.json({
          Response: {
            Success: "0",
            Message: "Please Provide Valid Booking Type",
          }
        });
      }
    } else {
      return res.json({
        Response: {
          Success: "0",
          Message: "Please Signup!",
        }
      });
    }
  });

//   ================================================================



app.post("/payment/status1", async (req, res) => {
    const booking_id = req.body.booking_id;
    const payment = req.body.pstatus;


    console.log("payment", payment)
    if (!booking_id) {
        const response = {
            Response: {
                Success: "0",
                message: "Please Provide booking_id!"
            }
        };
        return res.send(response);
    }

    if (!payment) {
        const response = {
            Response: {
                Success: "0",
                message: "Please Provide payment  1"
            }
        };
        return res.send(response);
    }
    const sql = `SELECT * FROM reservation_booking WHERE  approval_status="0" AND payment_status="0" AND booking_status="W" AND booking_id=${booking_id}`;
    con.query(sql, (error, result) => {
        if (error) {
            return res.send(error);
        }
        if (result.length === 0) {
            const response = {
                Response: {
                    Success: "0",
                    message: "Invalid Order Id"
                }
            };
            return res.json(response);
        }
        const tableStatus = result[0].payment_status;
        console.log("tableStatus", tableStatus)
        if (tableStatus != 1) {
            const formatedate = new Date()
            const sql2 = ` UPDATE reservation_booking SET payment_status=? ,updated_at=?,approval_status="1",booking_status="B" WHERE approval_status="0" AND booking_id=${booking_id}`;
            con.query(sql2, [payment, formatedate], (Error, result) => {
                if (Error) {
                    const response = {
                        Response: {
                            Success: "0",
                            message: "Failed to Added!"
                        }
                    };
                    return res.json(response);
                } else {
                    const response = {
                        Response: {
                            Success: "1",
                            message: "Payment!"
                        }
                    };
                    return res.json(response);
                }
            });
        } else {
            const response = {
                Response: {
                    Success: "0",
                    message: "already Paid!"
                }
            };
            return res.json(response);
        }
    });
})





app.get("/waiting/table/booking", async (req, res) => {
    let fromdate = req.query.fromdate;
    let todate = req.query.todate;
    if (!fromdate || !todate) {
        return res.send({
            Response: {
                success: '0',
                message: "Please provide fromdate and Todate!",
            }
        });
    }


    const fromDateParts = fromdate.split('/');
    const fromDateWithTime = `${fromDateParts[0]} 00:00:00`;
    const toDateParts = todate.split('/');
    const toDateWithTime = ` ${toDateParts[0]} 23:59:59`;


    let sql = `SELECT booking_id,reservation_id,reservation_catid,reservation_sub_catid,reservation_type,user_id,date,time,total_people,menu_type,approval_status,payment_status,booking_status,status,created_at FROM reservation_booking where booking_status="W" AND reservation_type="TA" AND  (created_at>='${fromDateWithTime}' AND created_at<='${toDateWithTime}') ORDER BY created_at DESC`;
    const result = await new Promise((resolve, reject) => {
        con.query(sql, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
    console.log(result)

    let promises = result.map(async (row) => {
        return new Promise((resolve, reject) => {
            const sql1 = ` SELECT  cat_title FROM reservation_category WHERE cat_id = ${row.reservation_catid};`
            con.query(sql1, (error, result1) => {
                if (error) {
                    reject(error);
                } else {
                    if (result1 && result1.length > 0) {
                        row.user = result1[0];
                    }
                    resolve(row);
                }
            });
        })
            .then((row) => {
                return new Promise((resolve, reject) => {
                    const sql2 = `SELECT sub_tilte,sub_cat_price_range  FROM reservation_sub_category WHERE reser_sub_id = ${row.reservation_sub_catid}`;
                    con.query(sql2, (error, result2) => {
                        if (error) {
                            reject(error);
                        } else {
                            if (result2 && result2.length > 0) {
                                row.vendor = result2[0];
                            }
                            resolve(row);
                        }
                    });
                })
            }).then((row) => {
                return new Promise((resolve, reject) => {
                    const sql2 = `SELECT name as user_name,mobile as user_mobile  FROM users WHERE id = ${row.user_id}`;
                    con.query(sql2, (error, result2) => {
                        if (error) {
                            reject(error);
                        } else {
                            if (result2 && result2.length > 0) {
                                row.reser = result2[0];
                            }
                            resolve(row);
                        }
                    });
                })
            })

    });


    const rows = await Promise.all(promises);
    rows.forEach((row) => {
        row.user = row.user || {};
        row.vendor = row.vendor || {};
        row.reser = row.reser || {};
        Object.assign(row, row.user, row.vendor, row.reser);
        delete row.user;
        delete row.vendor;
        delete row.reser;
    });

    if (rows.length > 0) {
        const response = {
            Response: {
                Success: "1",
                Message: "Success",
                Result: rows
            }
        };
        return res.json(response);
    } else {
        const response = {
            Response: {
                Success: "0",
                Message: "NO Records",
            }
        };
        return res.json(response)
    }
})



app.get("/payment/table/booking", async (req, res) => {
    let fromdate = req.query.fromdate;
    let todate = req.query.todate;
    if (!fromdate || !todate) {
        return res.send({
            Response: {
                success: '0',
                message: "Please provide fromdate and Todate!",
            }
        });
    }


    const fromDateParts = fromdate.split('/');
    const fromDateWithTime = `${fromDateParts[0]} 00:00:00`;
    const toDateParts = todate.split('/');
    const toDateWithTime = `${toDateParts[0]} 23:59:59`;


    let sql = `SELECT reservation_id,reservation_catid,reservation_sub_catid,reservation_type,user_id,date,time,total_people,menu_type,approval_status,payment_status,booking_status,status,created_at,updated_at FROM reservation_booking where payment_status="1" AND approval_status="1" AND booking_status="B" AND reservation_type="TA" AND  (created_at>='${fromDateWithTime}' AND created_at<='${toDateWithTime}') ORDER BY created_at DESC`;
    const result = await new Promise((resolve, reject) => {
        con.query(sql, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });

    let promises = result.map(async (row) => {
        return new Promise((resolve, reject) => {
            const sql1 = `SELECT  cat_title FROM reservation_category WHERE cat_id = ${row.reservation_catid}`;
            con.query(sql1, (error, result1) => {
                if (error) {
                    reject(error);
                } else {
                    if (result1 && result1.length > 0) {
                        row.user = result1[0];
                    }
                    resolve(row);
                }
            });
        })
            .then((row) => {
                return new Promise((resolve, reject) => {
                    const sql2 = `SELECT sub_tilte,sub_cat_price_range  FROM reservation_sub_category WHERE reser_sub_id = ${row.reservation_sub_catid}`;
                    con.query(sql2, (error, result2) => {
                        if (error) {
                            reject(error);
                        } else {
                            if (result2 && result2.length > 0) {
                                row.vendor = result2[0];
                            }
                            resolve(row);
                        }
                    });
                })
            }).then((row) => {
                return new Promise((resolve, reject) => {
                    const sql2 = `SELECT name as user_name,mobile as user_mobile  FROM users WHERE id = ${row.user_id}`;
                    con.query(sql2, (error, result2) => {
                        if (error) {
                            reject(error);
                        } else {
                            if (result2 && result2.length > 0) {
                                row.reser = result2[0];
                            }
                            resolve(row);
                        }
                    });
                })
            })

    });


    const rows = await Promise.all(promises);

    rows.forEach((row) => {

        row.user = row.user || {};
        row.vendor = row.vendor || {};
        row.reser = row.reser || {};
        Object.assign(row, row.user, row.vendor, row.reser);
        delete row.user;
        delete row.vendor;
        delete row.reser;
    });

    if (rows.length > 0) {
        const response = {
            Response: {
                Success: "1",
                Message: "Success",
                Result: rows
            }
        };
        return res.json(response);
    } else {
        const response = {
            Response: {
                Success: "0",
                Message: "NO Records",
            }
        };
        return res.json(response)
    }
})



app.get("/waiting/birthday/list", async (req, res) => {
    let fromdate = req.query.fromdate;
    let todate = req.query.todate;
    if (!fromdate || !todate) {
        return res.send({
            Response: {
                success: '0',
                message: "Please provide fromdate and Todate!",
            }
        });
    }

    const fromDateParts = fromdate.split('/');
    const fromDateWithTime = `${fromDateParts[0]} 00:00:00`;
    const toDateParts = todate.split('/');
    const toDateWithTime = `${toDateParts[0]} 23:59:59`;

    let sql = ` SELECT * FROM reservation_booking where  payment_status="0" AND approval_status="0" AND  booking_status="W" AND reservation_type="BP" AND  (created_at>='${fromDateWithTime}' AND created_at<='${toDateWithTime}') ORDER BY created_at DESC`;
    const result = await new Promise((resolve, reject) => {
        con.query(sql, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
    console.log(result)

    let promises = result.map(async (row) => {
        return new Promise((resolve, reject) => {
            const sql1 = `SELECT  cat_title FROM reservation_category WHERE cat_id = ${row.reservation_catid}`;
            con.query(sql1, (error, result1) => {
                if (error) {
                    reject(error);
                } else {
                    if (result1 && result1.length > 0) {
                        row.user = result1[0];
                    }
                    resolve(row);
                }
            });
        })
            .then((row) => {
                return new Promise((resolve, reject) => {
                    const sql2 = `SELECT sub_tilte,sub_cat_price_range  FROM reservation_sub_category WHERE reser_sub_id = ${row.reservation_sub_catid}`;
                    con.query(sql2, (error, result2) => {
                        if (error) {
                            reject(error);
                        } else {
                            if (result2 && result2.length > 0) {
                                row.vendor = result2[0];
                            }
                            resolve(row);
                        }
                    });
                })
            }).then((row) => {
                return new Promise((resolve, reject) => {
                    const sql2 = `SELECT name as user_name,mobile as user_mobile  FROM users WHERE id = ${row.user_id}`;
                    con.query(sql2, (error, result2) => {
                        if (error) {
                            reject(error);
                        } else {
                            if (result2 && result2.length > 0) {
                                row.reser = result2[0];
                            }
                            resolve(row);
                        }
                    });
                })
            })

    });


    const rows = await Promise.all(promises);

    rows.forEach((row) => {

        row.user = row.user || {};
        row.vendor = row.vendor || {};
        row.reser = row.reser || {};
        Object.assign(row, row.user, row.vendor, row.reser);
        delete row.user;
        delete row.vendor;
        delete row.reser;
    });

    if (rows.length > 0) {
        const response = {
            Response: {
                Success: "1",
                Message: "Success",
                Result: rows
            }
        };
        return res.json(response);
    } else {
        const response = {
            Response: {
                Success: "0",
                Message: "NO Records",
            }
        };
        return res.json(response)
    }
})



app.get("/payment/birthday/list", async (req, res) => {
    let fromdate = req.query.fromdate;
    let todate = req.query.todate;
    if (!fromdate || !todate) {
        return res.send({
            Response: {
                success: '0',
                message: "Please provide fromdate and Todate!",
            }
        });
    }


    const fromDateParts = fromdate.split('/');
    const fromDateWithTime = `${fromDateParts[0]} 00:00:00`;
    const toDateParts = todate.split('/');
    const toDateWithTime = `${toDateParts[0]} 23:59:59`;


    let sql = `SELECT * FROM reservation_booking where  payment_status="1" AND approval_status="1" AND  booking_status="B" AND reservation_type="BP" AND  (created_at>='${fromDateWithTime}' AND created_at<='${toDateWithTime}') ORDER BY created_at DESC`;
    const result = await new Promise((resolve, reject) => {
        con.query(sql, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });

    let promises = result.map(async (row) => {
        return new Promise((resolve, reject) => {
            const sql1 = `SELECT  cat_title FROM reservation_category WHERE cat_id = ${row.reservation_catid}`;
            con.query(sql1, (error, result1) => {
                if (error) {
                    reject(error);
                } else {
                    if (result1 && result1.length > 0) {
                        row.user = result1[0];
                    }
                    resolve(row);
                }
            });
        })
            .then((row) => {
                return new Promise((resolve, reject) => {
                    const sql2 = `SELECT sub_tilte,sub_cat_price_range  FROM reservation_sub_category WHERE reser_sub_id = ${row.reservation_sub_catid}`;
                    con.query(sql2, (error, result2) => {
                        if (error) {
                            reject(error);
                        } else {
                            if (result2 && result2.length > 0) {
                                row.vendor = result2[0];
                            }
                            resolve(row);
                        }
                    });
                })
            }).then((row) => {
                return new Promise((resolve, reject) => {
                    const sql2 = `SELECT name as user_name,mobile as user_mobile  FROM users WHERE id = ${row.user_id}`;
                    con.query(sql2, (error, result2) => {
                        if (error) {
                            reject(error);
                        } else {
                            if (result2 && result2.length > 0) {
                                row.reser = result2[0];
                            }
                            resolve(row);
                        }
                    });
                })
            })

    });


    const rows = await Promise.all(promises);

    rows.forEach((row) => {

        row.user = row.user || {};
        row.vendor = row.vendor || {};
        row.reser = row.reser || {};
        Object.assign(row, row.user, row.vendor, row.reser);
        delete row.user;
        delete row.vendor;
        delete row.reser;
    });

    if (rows.length > 0) {
        const response = {
            Response: {
                Success: "1",
                Message: "Success",
                Result: rows
            }
        };
        return res.json(response);
    } else {
        const response = {
            Response: {
                Success: "0",
                Message: "NO Records",
            }
        };
        return res.json(response)
    }
})


// ===========================================usergetdetails
app.get("/usergetdetails", async (req, res) => {
    const userid = req.query.userid
    let sql;
    if (!userid) {
        sql = `select * from users where status="1"`
    } else {
        sql = `select * from users where status="1" and id=${userid}`
    }
    const exesqlquery = await executeQuery(sql)

    if (exesqlquery.length > 0) {
        const response = {
            Response: {
                Success: "1",
                message: "Success",
                result: exesqlquery
            }
        };
        return res.json(response);
    }
    else {
        const response = {
            Response: {
                Success: "0",
                message: "No Records!",
            }
        };
        return res.json(response);
    }
})


// ==================================================usergetdetails/update
app.post("/usergetdetails/update/api", async (req, res) => {
    try {
        const id = req.body.id;
        if (!id) {
            return res.json({
                success: '0',
                message: "User ID required!"
            });
        }

        const sql = `SELECT * FROM users WHERE status="1" AND  id=${id}`;
        con.query(sql, async (error, result) => {
            if (error) {
                return res.json({
                    success: '0',
                    message: error.message
                });
            } else {
                if (result.length === 0) {
                    return res.json({
                        success: '0',
                        message: "User not found."
                    });
                }


                const existingData = result[0];


                const { name, email, password, mobile, address } = req.body;



                const updatename = name || existingData.name;
                const updateemail = email || existingData.email;
                const updatepassword = password || existingData.password;
                const updatemobile = mobile || existingData.mobile;
                const updateaddress = address || existingData.address;


                const updateSql = ` UPDATE user SET name=?, email=?, password=?,mobile=?,address=? WHERE  status="1"  AND id=?`;
                con.query(updateSql, [updatename, updateemail, updatepassword, updatemobile, updateaddress, id], (updateError, updateResult) => {
                    if (updateError) {
                        return res.json({
                            success: '0',
                            message: updateError.message
                        });
                    } else {
                        return res.json({
                            success: '1',
                            message: "Updated!"
                        });
                    }
                });
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: '0',
            message: error.message,
        });
    }
});

// ===========================================================changepassword
app.post("/changepassword/api", async (req, res) => {
    try {
        const id = req.body.id;
        if (!id) {
            return res.json({
                success: '0',
                message: "User ID required!"
            });
        }

        const sql = `SELECT * FROM users WHERE status="1" AND  id=${id}`;
        con.query(sql, async (error, result) => {
            if (error) {
                return res.json({
                    success: '0',
                    message: error.message
                });
            } else {
                if (result.length === 0) {
                    return res.json({
                        success: '0',
                        message: "User not found."
                    });
                }


                const { Password } = req.body;

                if (result.length === 0) {
                    return res.json({
                        success: '0',
                        message: "User not found."
                    });
                }

                const existingData = result[0];
                const oldPassword = existingData.password;
                if (oldPassword !== Password) {
                    return res.json({
                        success: '0',
                        message: "Old password is incorrect"
                    });
                }

                const updateSql = `UPDATE user SET  password=? WHERE  status="1"  AND id=?`;
                con.query(updateSql, [Password, id], (updateError, updateResult) => {
                    if (updateError) {
                        return res.json({
                            success: '0',
                            message: updateError.message
                        });
                    } else {
                        return res.json({
                            success: '1',
                            message: "Updated!"
                        });
                    }
                });
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: '0',
            message: error.message,
        });
    }
});



// ===========================================================



app.get("/candle/light/dinner/menulist", async (req, res) => {
    const reser_sub_id = req.query.reser_sub_id
    if (!reser_sub_id) {
        return res.send({
            success: '0',
            message: "reser_sub_id required!",
        });
    }

    let sql;
    sql = `select menu_id, menu_title from menu_item where menu_type = "C" and manu_reser_sub_cat_id = ${reser_sub_id}`
    con.query(sql, (error, result) => {
        if (error) {
            return res.json({
                success: '0',
                message: error.message,
            });
        } else {
            return res.json({
                success: '1',
                message: "Success",
                result: result
            });
        }
    });


})


app.get("/candle/light/dinner/menu_item_list", async (req, res) => {
    const menuitem_id = req.query.menuitem_id
    if (!menuitem_id) {
        return res.send({
            success: '0',
            message: "menuitem_id required!",
        });
    }

    let sql;
    sql = `select menu_id, menu_title, menu_img, menu_type, manu_reser_sub_cat_id, menu_cat_id from menu_item where menu_type = "S" and menu_cat_id = ${menuitem_id}`
    con.query(sql, (error, result) => {
        if (error) {
            return res.json({
                success: '0',
                message: error.message,
            });
        } else {

            const resposne = result.map((item) => {

                return {
                    menu_id: item.menu_id,
                    menu_title: item.menu_title,
                    menu_type: item.menu_type,
                    menu_cat_id: item.menu_cat_id,
                }
            })


            return res.json({
                success: '1',
                message: "Success",
                result: resposne
            });
        }
    });
})



app.get("/candle/light/dinner/menu_item_image/list", async (req, res) => {
    const reser_sub_id = req.query.reser_sub_id;
    let sql;

    sql = `SELECT * FROM menu_item WHERE menu_type = "C" AND manu_reser_sub_cat_id = ${reser_sub_id}`;

    try {
        const exesqlquery = await executeQuery(sql);

        if (exesqlquery.length > 0) {
            const firstimgurl = 'http://localhost:3004/images/';

            const result = await Promise.all(exesqlquery.map(async (item) => {

                const categoryquery = `SELECT CONCAT('${firstimgurl}', menu_img) AS image_url FROM menu_item WHERE menu_type = "S" and menu_cat_id = ?`;

                return await executeQuery(categoryquery, [item.menu_id]);


            }));

            return res.json({
                Success: "1",
                message: "Success",
                result: result.flat()
            });
        } else {
            return res.json({
                Success: "0",
                message: "No Records!",
            });
        }
    } catch (error) {
        console.error("Error executing SQL query:", error);
        return res.status(500).json({
            Success: "0",
            message: "Internal Server Error"
        });
    }
});


// =-=-=-=-=-=--=-=--=-=-=-=-=-=-=-=-=-


app.post("/birthday/category/add", async (req, res) => {
    try {
        const { menuitem_title, reser_sub_catid, menu_type } = req.body;

        // Validate required fields
        if (!menuitem_title) {
            return res.send({
                success: '0',
                message: "menuitem_title required!",
            });
        }
        if (!reser_sub_catid) {
            return res.send({
                success: '0',
                message: "reser_sub_catid required!",
            });
        }
        if (!menu_type) {
            return res.send({
                success: '0',
                message: "menu_type required!",
            });
        }

        const formattedDate = new Date();

        // Insert data into MySQL table
        const sql = `INSERT INTO menu_item (menu_title, manu_reser_sub_cat_id, menu_type, created_at) VALUES(?,?,?,?)`;
        const sqlValues = [menuitem_title, reser_sub_catid, menu_type, formattedDate];

        con.query(sql, sqlValues, (error, result) => {
            if (error) {
                return res.json({
                    success: '0',
                    message: error.message, // Sending only error message
                });
            } else {
                return res.json({
                    success: '1',
                    message: "Added!",
                });
            }
        });
    } catch (error) {
        return res.status(200).json({
            success: '0',
            message: error.message,
        });
    }
});


app.post("/birthday/category/cat/add", async (req, res) => {
    try {
        const { menuitem_title, catid, menu_type, amount } = req.body;

        // Validate required fields
        if (!menuitem_title) {
            return res.send({
                success: '0',
                message: "menuitem_title required!",
            });
        }
        if (!catid) {
            return res.send({
                success: '0',
                message: "catid required!",
            });
        }
        if (!menu_type) {
            return res.send({
                success: '0',
                message: "menu_type required!",
            });
        }

        if (!amount) {
            return res.send({
                success: '0',
                message: "amount required!",
            });
        }

        const formattedDate = new Date();

        const sql = `INSERT INTO menu_item (menu_title, menu_cat_id, menu_type, amount, created_at) VALUES(?,?,?,?,?)`;
        const sqlValues = [menuitem_title, catid, menu_type, amount, formattedDate];

        con.query(sql, sqlValues, (error, result) => {
            if (error) {
                return res.json({
                    success: '0',
                    message: error.message,
                });
            } else {
                return res.json({
                    success: '1',
                    message: "Added!",
                });
            }
        });
    } catch (error) {
        return res.status(200).json({
            success: '0',
            message: error.message,
        });
    }
});


app.get("/birthday/category/get", async (req, res) => {
    const reser_cat_id = req.query.reser_cat_id;
    const type = req.query.type;

    if (!reser_cat_id) {
        return res.send({
            success: '0',
            message: "reser_cat_id required!",
        });
    }

    if (!type) {
        return res.send({
            success: '0',
            message: "type required!",
        });
    }

    let arrayresponse = [];
    let response = {};

    try {
        const sql = `SELECT menu_title, menu_id, menu_img FROM menu_item WHERE menu_type =? AND manu_reser_sub_cat_id =?`;
        const queryParams = [type, reser_cat_id];
        const execQuery = await executeQuery(sql, queryParams);

        if (execQuery.length > 0) {
            response.menu_title = execQuery[0].menu_title;
            response.menu_id = execQuery[0].menu_id;


            const sql2 = `SELECT menu_title, menu_id, amount FROM menu_item WHERE menu_type =? AND menu_cat_id =?`;
            const queryParams2 = [type, execQuery[0].menu_id];
            const execQuery2 = await executeQuery(sql2, queryParams2);


            response.pricelist = execQuery2.map(item => ({
                menu_sub_title: item.menu_title,
                menu_sub_id: item.menu_id,
                amount: item.amount
            }));

            arrayresponse.push(response);
        }

        if (arrayresponse.length === 0) {
            return res.send({
                success: '0',
                message: "No Records!",
            });
        } else {
            return res.send({
                success: '1',
                message: "Success",
                result: arrayresponse
            });
        }
    } catch (error) {
        console.error(error);
        return res.send({
            success: '0',
            message: "An error occurred while fetching data",
        });
    }
});



// =========================================================mail
async function mailbooking(id,) {
    const booking_id = id

    let arrayresponse = [];
    let response;


    try {
        const sql = `SELECT * FROM reservation_booking WHERE booking_status = "W" AND booking_id = ?`;
        const executequerysql = await executeQuery(sql, [booking_id]);



        response = {
            reservation_id: executequerysql[0].reservation_id,
            reservation_catid: executequerysql[0].reservation_catid,
            reservation_sub_catid: executequerysql[0].reservation_sub_catid,
            user_id: executequerysql[0].user_id,
            date: executequerysql[0].date,
            time: executequerysql[0].time,
            menu_type: executequerysql[0].menu_type,
            reservation_type: executequerysql[0].reservation_type === "TA" ? "Table Booking" : executequerysql[0].reservation_type === "CL" ? "Candle Light Dinner" : "",
        };

        const sql2 = `SELECT cat_title, price_range FROM reservation_category WHERE cat_id = ?`;
        const executequerysql2 = await executeQuery(sql2, [response.reservation_catid]);
        if (executequerysql2.length > 0) {
            Object.assign(response, executequerysql2[0]);
        }

        const sql3 = ` SELECT sub_tilte, sub_cat_price_range FROM reservation_sub_category WHERE reser_sub_id = ?`;
        const executequerysql3 = await executeQuery(sql3, [response.reservation_sub_catid]);
        if (executequerysql3.length > 0) {
            Object.assign(response, executequerysql3[0]);
        }

        const sql4 = ` SELECT name, email, mobile FROM users WHERE id = ?`;
        const executequerysql4 = await executeQuery(sql4, [response.user_id]);
        if (executequerysql4.length > 0) {
            Object.assign(response, executequerysql4[0]);
        }

        arrayresponse.push(response);
        console.log(arrayresponse)
        await mailcodefunction(arrayresponse)

    } catch (error) {
        console.error("Error executing query:", error);

    }
}

function executeQuery(query, params) {
    return new Promise((resolve, reject) => {
        con.query(query, params, (error, results) => {
            if (error) {
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
}

// ------------------------------------------------------

const nodemailer =require('nodemailer')

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'mailto:boopathiperiyasamy2@gmail.com',
      pass: 'sscy lujo hrjk yjio'
    }
  });

async function mailcodefunction(data) {
    const reservationDetails = data[0]
    var mailOptions = {
        from: 'boopathiperiyasamy2@gmail.com',
        to: 'gowthamjohnson6@gmail.com',
        subject: 'Reservation Confirmation',
        html: `
      <!DOCTYPE html>
      <html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
      <head>
        <meta charset="UTF-8">
        <meta content="width=device-width, initial-scale=1" name="viewport">
        <meta name="x-apple-disable-message-reformatting">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta content="telephone=no" name="format-detection">
        <link href="https://fonts.googleapis.com/css2?family=Rubik+Scribble&display=swap" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Courgette&family=Rubik+Scribble&display=swap" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400..700&family=Lobster&display=swap" rel="stylesheet">
        <title>Reservation Confirmation</title>
        <style>
          .over_all {
            background: linear-gradient(to bottom, rgba(255, 215, 0, 0.9),rgba(0, 0, 0, 0.8),
                rgba(0, 0, 0, 0.8),rgba(0, 0, 0, 0.8),rgba(255, 215, 0, 0.9));
            background-position: center;
            background-size: cover;
            background-repeat: no-repeat;
            border-radius: 3vh;
            width: 50%;
            margin-left: auto;
            margin-right: auto;
            padding-bottom: 3vh;
            padding-top: 2vh;
          }
  
          #logo {
            display: block;
            box-shadow:
              0 0 10px rgba(255, 215, 0, 0.8),
              0 0 20px rgba(255, 215, 0, 0.9),
              0 0 20px rgba(255, 215, 0, 0.9);
            border-radius: 50%;
            background-color: black;
            margin-top: 2vh;
            padding: 1vh;
            width: 14vh;
          }
  
          h1 {
            margin-top: 2vh;
            margin-bottom: 0;
            font-family: Lobster;
          }
  
          .top_content {
            font-size: 2.6vh;
            margin-left: 5vh;
            font-family: Lobster;
          }
  
          .content {
            color: white;
            align-items: start;
            padding-left: 5vh;
            padding-right: 5vh;
          }
  
          .bill_table {
            background-image: url('https://img.freepik.com/free-vector/yellow-diagonal-geometric-striped-background-with-halftone-detailed_1409-1451.jpg?w=1380&t=st=1711880527~exp=1711881127~hmac=d6c710b52ef8ad9c099eb3e16469a5e0914d54d6e436dec891cc2e6b977cd654');
            background-position: center;
            background-size: cover;
            background-repeat: no-repeat;
            border-radius: 1vh;
            width: 70%;
            border: 2px solid #fcb713;
            border-collapse: collapse;
            margin: 0 auto;
            text-align: center;
            color: #000;
            font-family: Courgette;
            margin-top: 3vh;
          }
  
          tr {
            font-weight: 400;
            font-size: 3vh;
          }
  
          .tr_head {
            font-weight: bolder;
            font-size: 3vh;
          }
  
          .btm_content {
            font-size: 2.6vh;
            font-family: Lobster;
          }
  
          .footer {
            display: flex;
            justify-content: space-around;
            width: 90%;
            text-align: center;
          }
  
          .footer_content {
            color: white;
            font-size: 2.6vh;
            font-family: Lobster;
          }
  
          @media all and (max-width: 425px) {
            .over_all {
              background: linear-gradient(to bottom, rgba(255, 215, 0, 0.9),rgba(0, 0, 0, 0.8),
                  rgba(0, 0, 0, 0.8),rgba(0, 0, 0, 0.8),rgba(255, 215, 0, 0.9));
              background-position: center;
              background-size: cover;
              background-repeat: no-repeat;
              border-radius: 3vh;
              width: 100%;
              margin-left: auto;
              margin-right: auto;
              padding-bottom: 3vh;
            }
            #logo {
              display: block;
              box-shadow:
                0 0 10px rgba(255, 215, 0, 0.8),
                0 0 20px rgba(255, 215, 0, 0.9),
                0 0 20px rgba(255, 215, 0, 0.9);
              border-radius: 50%;
              background-color: black;
              margin-top: 2vh;
              padding: 1vh;
              width: 6vh;
            }
  
            h1 {
              margin-top: 0;
              margin-bottom: 0;
              font-family: Lobster;
              font-size: 2.5vh;
              margin-top: 2vh;
            }
  
            .top_content {
              font-size: 1.6vh;
              margin-left: 2vh;
              font-family: Lobster;
            }
  
            .content {
              color: white;
              align-items: start;
              padding-left: 1.5vh;
              padding-right: 1.5vh;
            }
  
            .bill_table {
              background-image: url('https://img.freepik.com/free-vector/yellow-diagonal-geometric-striped-background-with-halftone-detailed_1409-1451.jpg?w=1380&t=st=1711880527~exp=1711881127~hmac=d6c710b52ef8ad9c099eb3e16469a5e0914d54d6e436dec891cc2e6b977cd654');
              background-position: center;
              background-size: cover;
              background-repeat: no-repeat;
              border-radius: 1vh;
              width: 100%;
              border: 2px solid #fcb713;
              border-collapse: collapse;
              margin: 0 auto;
              text-align: center;
              color: #000;
              font-family: Courgette;
              margin-top: 3vh;
            }
  
            tr {
              font-weight: 400;
              font-size: 1.6vh;
            }
  
            .tr_head {
              font-weight: bolder;
              font-size: 2vh;
            }
  
            .btm_content {
              font-size: 1.6vh;
              font-family: Lobster;
            }
  
            .footer {
              display: flex;
              flex-direction: row;
              justify-content: space-around;
              width: 100%;
              text-align: center;
            }
  
            .footer_content {
              color: white;
              font-size: 1.6vh;
              font-family: Lobster;
            }
          }
        </style>
      </head>
  
      <body>
        <div class="over_all">
          <table style="text-align: center; margin: 0 auto;">
            <tr>
              <td style="display: flex; justify-content: center;">
                <img id="logo" class="adapt-img esdev-stretch-width esdev-banner-rendered"
                  src="http://hifivecafe.com/wp-content/uploads/2021/03/Hifive-Logo-1.png" alt="title">
              </td>
            </tr>
          </table>
  
          <div class="content">
            <h1>Dear Customer , welcome to Hifive</h1>
            <p class="top_content">We are thrilled to inform you that your table reservation has been successfully confirmed! Thank you for choosing Hifive Cafe for your special occasion.</p>
  
            <h2>Reservation Details</h2>
             <h6>${reservationDetails.reservation_type}</h6>
            <p class="top_content">
              Reservation Category: ${reservationDetails.cat_title}<br>
              Price Range: ${reservationDetails.price_range}<br>
              Reservation Sub Category: ${reservationDetails.sub_tilte}<br>
              Sub Category Price Range: ${reservationDetails.sub_cat_price_range}<br>
              Booking  Date: ${new Date(reservationDetails.date).toLocaleDateString()}<br>
              Booking Time: ${reservationDetails.time}<br>
              Name: ${reservationDetails.name}<br>
              Email: ${reservationDetails.email}<br>
              Mobile: ${reservationDetails.mobile}
            </p>
  
            <p class="btm_content">
              Please review the details above and let us know if there are any discrepancies or if you require any further modifications.
              <br><br>
              Your reservation is scheduled for the mentioned date and time. We look forward to serving you.
              <br><br>
              Should you have any questions or concerns regarding your reservation, feel free to reach out to us at the below contact number.
            </p>
  
            <div class="footer">
              <p class="footer_content">📞9940888633</p>
              <p class="footer_content">📧contact@hifivecafe.com</p>
            </div>
          </div>
        </div>
      </body>
      </html>
      `
    };

    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
            res.status(200).send('Internal Server Error');
        } else {
            console.log('Email sent: ' + info.response);
            res.status(200).send('Email sent successfully');
        }
    });
}


// ----------------------------------------------------------------------------
async function birthdaymailbooking(id) {
    const booking_id = id
  
    let arrayresponse = [];
    let response;
  
    try {
      const sql =` SELECT * FROM reservation_booking WHERE booking_status = "W" AND booking_id = ?`;
      const executequerysql = await executeQuery(sql, [booking_id]);
      response = {
    reservation_id: executequerysql[0].reservation_id,
    reservation_catid: executequerysql[0].reservation_catid,
    reservation_sub_catid: executequerysql[0].reservation_sub_catid,
    user_id: executequerysql[0].user_id,
    date: executequerysql[0].date,
    time: executequerysql[0].time,
    menu_type: executequerysql[0].menu_type,
    reservation_type: executequerysql[0].reservation_type == "TA" ? "Table Booking" : executequerysql[0].reservation_type == "CL" ? "Candle Light Dinner":executequerysql[0].reservation_type == "BP" ?"BIRTHDAY PARTY":"",
    photo_shoot: executequerysql[0].photo_shoot,
    bouquet: executequerysql[0].bouquet,
    fire_crackers: executequerysql[0].fire_crackers,
    balloon: executequerysql[0].balloon,
    cake_shape: executequerysql[0].cake_shape,
    cake_decription: executequerysql[0].cake_decription,
    final_amt: executequerysql[0].final_amt,
    flavour: executequerysql[0].flavour,
  }
  
      const sql2 = `SELECT cat_title, price_range FROM reservation_category WHERE cat_id = ?`;
      const executequerysql2 = await executeQuery(sql2, [response.reservation_catid]);
      if (executequerysql2.length > 0) {
        Object.assign(response, executequerysql2[0]);
      }
  
      const sql3 =` SELECT sub_tilte, sub_cat_price_range FROM reservation_sub_category WHERE reser_sub_id = ?`;
      const executequerysql3 = await executeQuery(sql3, [response.reservation_sub_catid]);
      if (executequerysql3.length > 0) {
        Object.assign(response, executequerysql3[0]);
      }
  
      const sql4 = `SELECT name, email, mobile FROM users WHERE id = ?`;
      const executequerysql4 = await executeQuery(sql4, [response.user_id]);
      if (executequerysql4.length > 0) {
        Object.assign(response, executequerysql4[0]);
      }
  
      arrayresponse.push(response);
    console.log(arrayresponse)
    await birthday_mailcodefunction(arrayresponse)
  
    } catch (error) {
      console.error("Error executing query:", error);
     
    }
  }
  
  async function birthday_mailcodefunction(data){
    const reservationDetails = data[0]
    var mailOptions = {
      from: 'boopathiperiyasamy2@gmail.com',
      to: 'gowthamjohnson6@gmail.com',
      subject: 'Reservation Confirmation',
      html: `
      <!DOCTYPE html>
      <html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
      <head>
        <meta charset="UTF-8">
        <meta content="width=device-width, initial-scale=1" name="viewport">
        <meta name="x-apple-disable-message-reformatting">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta content="telephone=no" name="format-detection">
        <link href="https://fonts.googleapis.com/css2?family=Rubik+Scribble&display=swap" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Courgette&family=Rubik+Scribble&display=swap" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400..700&family=Lobster&display=swap" rel="stylesheet">
        <title>Reservation Confirmation</title>
        <style>
          .over_all {
            background: linear-gradient(to bottom, rgba(255, 215, 0, 0.9),rgba(0, 0, 0, 0.8),
                rgba(0, 0, 0, 0.8),rgba(0, 0, 0, 0.8),rgba(255, 215, 0, 0.9));
            background-position: center;
            background-size: cover;
            background-repeat: no-repeat;
            border-radius: 3vh;
            width: 50%;
            margin-left: auto;
            margin-right: auto;
            padding-bottom: 3vh;
            padding-top: 2vh;
          }
  
          #logo {
            display: block;
            box-shadow:
              0 0 10px rgba(255, 215, 0, 0.8),
              0 0 20px rgba(255, 215, 0, 0.9),
              0 0 20px rgba(255, 215, 0, 0.9);
            border-radius: 50%;
            background-color: black;
            margin-top: 2vh;
            padding: 1vh;
            width: 14vh;
          }
  
          h1 {
            margin-top: 2vh;
            margin-bottom: 0;
            font-family: Lobster;
          }
  
          .top_content {
            font-size: 2.6vh;
            margin-left: 5vh;
            font-family: Lobster;
          }
  
          .content {
            color: white;
            align-items: start;
            padding-left: 5vh;
            padding-right: 5vh;
          }
  
          .bill_table {
            background-image: url('https://img.freepik.com/free-vector/yellow-diagonal-geometric-striped-background-with-halftone-detailed_1409-1451.jpg?w=1380&t=st=1711880527~exp=1711881127~hmac=d6c710b52ef8ad9c099eb3e16469a5e0914d54d6e436dec891cc2e6b977cd654');
            background-position: center;
            background-size: cover;
            background-repeat: no-repeat;
            border-radius: 1vh;
            width: 70%;
            border: 2px solid #fcb713;
            border-collapse: collapse;
            margin: 0 auto;
            text-align: center;
            color: #000;
            font-family: Courgette;
            margin-top: 3vh;
          }
  
          tr {
            font-weight: 400;
            font-size: 3vh;
          }
  
          .tr_head {
            font-weight: bolder;
            font-size: 3vh;
          }
  
          .btm_content {
            font-size: 2.6vh;
            font-family: Lobster;
          }
  
          .footer {
            display: flex;
            justify-content: space-around;
            width: 90%;
            text-align: center;
          }
  
          .footer_content {
            color: white;
            font-size: 2.6vh;
            font-family: Lobster;
          }
  
          @media all and (max-width: 425px) {
            .over_all {
              background: linear-gradient(to bottom, rgba(255, 215, 0, 0.9),rgba(0, 0, 0, 0.8),
                  rgba(0, 0, 0, 0.8),rgba(0, 0, 0, 0.8),rgba(255, 215, 0, 0.9));
              background-position: center;
              background-size: cover;
              background-repeat: no-repeat;
              border-radius: 3vh;
              width: 100%;
              margin-left: auto;
              margin-right: auto;
              padding-bottom: 3vh;
            }
            #logo {
              display: block;
              box-shadow:
                0 0 10px rgba(255, 215, 0, 0.8),
                0 0 20px rgba(255, 215, 0, 0.9),
                0 0 20px rgba(255, 215, 0, 0.9);
              border-radius: 50%;
              background-color: black;
              margin-top: 2vh;
              padding: 1vh;
              width: 6vh;
            }
  
            h1 {
              margin-top: 0;
              margin-bottom: 0;
              font-family: Lobster;
              font-size: 2.5vh;
              margin-top: 2vh;
            }
  
            .top_content {
              font-size: 1.6vh;
              margin-left: 2vh;
              font-family: Lobster;
            }
  
            .content {
              color: white;
              align-items: start;
              padding-left: 1.5vh;
              padding-right: 1.5vh;
            }
  
            .bill_table {
              background-image: url('https://img.freepik.com/free-vector/yellow-diagonal-geometric-striped-background-with-halftone-detailed_1409-1451.jpg?w=1380&t=st=1711880527~exp=1711881127~hmac=d6c710b52ef8ad9c099eb3e16469a5e0914d54d6e436dec891cc2e6b977cd654');
              background-position: center;
              background-size: cover;
              background-repeat: no-repeat;
              border-radius: 1vh;
              width: 100%;
              border: 2px solid #fcb713;
              border-collapse: collapse;
              margin: 0 auto;
              text-align: center;
              color: #000;
              font-family: Courgette;
              margin-top: 3vh;
            }
  
            tr {
              font-weight: 400;
              font-size: 1.6vh;
            }
  
            .tr_head {
              font-weight: bolder;
              font-size: 2vh;
            }
  
            .btm_content {
              font-size: 1.6vh;
              font-family: Lobster;
            }
  
            .footer {
              display: flex;
              flex-direction: row;
              justify-content: space-around;
              width: 100%;
              text-align: center;
            }
  
            .footer_content {
              color: white;
              font-size: 1.6vh;
              font-family: Lobster;
            }
          }
        </style>
      </head>
  
      <body>
        <div class="over_all">
          <table style="text-align: center; margin: 0 auto;">
            <tr>
              <td style="display: flex; justify-content: center;">
                <img id="logo" class="adapt-img esdev-stretch-width esdev-banner-rendered"
                  src="http://hifivecafe.com/wp-content/uploads/2021/03/Hifive-Logo-1.png" alt="title">
              </td>
            </tr>
          </table>
  
          <div class="content">
            <h1>Dear Customer , welcome to Hifive</h1>
            <p class="top_content">We are thrilled to inform you that your table reservation has been successfully confirmed! Thank you for choosing Hifive Cafe for your special occasion.</p>
  
            <h2>Reservation Details</h2>
             <h6>${reservationDetails.reservation_type}</h6>
            <p class="top_content">
              Reservation Category: ${reservationDetails.cat_title}<br>
              Price Range: ${reservationDetails.price_range}<br>
              Reservation Sub Category: ${reservationDetails.sub_tilte}<br>
              Reservation Category: ${reservationDetails.cat_title}<br>
              photo_shoot : ${reservationDetails.photo_shoot}<br>
              bouquet: ${reservationDetails.fire_crackers}<br>
              fire_crackers: ${reservationDetails.cat_title}<br>
              balloon: ${reservationDetails.balloon}<br>
              cake_shape: ${reservationDetails.cake_shape}<br>
              cake_decription: ${reservationDetails.cake_decription}<br>
              final_amt: ${reservationDetails.final_amt}<br>
              flavour: ${reservationDetails.flavour}<br>
              Sub Category Price Range: ${reservationDetails.sub_cat_price_range}<br>
              Booking  Date: ${new Date(reservationDetails.date).toLocaleDateString()}<br>
              Booking Time: ${reservationDetails.time}<br>
              Name: ${reservationDetails.name}<br>
              Email: ${reservationDetails.email}<br>
              Mobile: ${reservationDetails.mobile}
            </p>
  
            <p class="btm_content">
              Please review the details above and let us know if there are any discrepancies or if you require any further modifications.
              <br><br>
              Your reservation is scheduled for the mentioned date and time. We look forward to serving you.
              <br><br>
              Should you have any questions or concerns regarding your reservation, feel free to reach out to us at the below contact number.
            </p>
  
            <div class="footer">
              <p class="footer_content">📞9940888633</p>
              <p class="footer_content">📧contact@hifivecafe.com</p>
            </div>
          </div>
        </div>
      </body>
      </html>
      `
    };
  
    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        res.status(200).send('Internal Server Error');
      } else {
        console.log('Email sent: ' + info.response);
        res.status(200).send('Email sent successfully');
      }
    });
  }


app.listen(3004)

