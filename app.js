
const imageUpload = document.getElementById("image-upload");
const productGrid = document.getElementById("product-grid");
const productCount = document.getElementById("product-count");
const categoryButtons = document.querySelectorAll(".category-card");
const uploadPanel = document.querySelector(".upload-panel");

const categories = {
    men: "ملابس رجالي",
    women: "ملابس حريمي",
    kids: "ملابس أطفال",
    lingerie: "لانجري",
    home: "أدوات منزلية"
};

let products = [];
let selectedCategory = "all";
let nextId = 1;
let db;
let isReady = false;
let activeGallery = null;

// =====================================
// 1. قاعدة بيانات حفظ الصور والموديلات
// =====================================

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("SouqnaDatabase", 1);

        request.onupgradeneeded = () => {
            const database = request.result;

            if (!database.objectStoreNames.contains("products")) {
                database.createObjectStore("products", {
                    keyPath: "id"
                });
            }
        };

        request.onsuccess = () => {
            db = request.result;
            resolve();
        };

        request.onerror = () => reject(request.error);
    });
}

function saveProduct(product) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("products", "readwrite");
        const saved = {
            ...product,
            images: product.images.map(image => ({
                fileName: image.fileName,
                blob: image.blob
            }))
        };

        transaction.objectStore("products").put(saved);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

function loadProducts() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("products", "readonly");
        const request = transaction.objectStore("products").getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function deleteSavedProduct(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("products", "readwrite");
        transaction.objectStore("products").delete(id);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

// =====================================
// 2. إعداد روابط الصور
// =====================================

function prepareProduct(product) {
    product.images = product.images.map(image => ({
        ...image,
        url: URL.createObjectURL(image.blob)
    }));

    return product;
}

function releaseProductImages(product) {
    product.images.forEach(image => {
        if (image.url) URL.revokeObjectURL(image.url);
    });
}

// =====================================
// 3. أدوات رفع الموديل الجديد
// =====================================

const categorySelect = document.createElement("select");
categorySelect.id = "upload-category";

Object.entries(categories).forEach(([key, value]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = value;
    categorySelect.appendChild(option);
});

const categoryLabel = document.createElement("label");
categoryLabel.textContent = "قسم الموديل";
categoryLabel.htmlFor = "upload-category";

const modelName = document.createElement("input");
modelName.type = "text";
modelName.id = "model-name";
modelName.placeholder = "اسم الموديل، مثال: عباية شتوي";

categorySelect.style.cssText =
    "display:block;width:100%;max-width:350px;box-sizing:border-box;padding:11px;margin:0 auto 10px;border:1px solid #ccc;border-radius:8px;font-family:inherit;";

categoryLabel.style.cssText =
    "display:block;margin:15px 0 5px;";

modelName.style.cssText =
    "display:block;width:100%;max-width:350px;box-sizing:border-box;padding:11px;margin:10px auto;border:1px solid #ccc;border-radius:8px;font-family:inherit;";

const uploadButton = uploadPanel.querySelector(".upload-button");

uploadPanel.insertBefore(categoryLabel, uploadButton);
uploadPanel.insertBefore(categorySelect, uploadButton);
uploadPanel.insertBefore(modelName, uploadButton);

uploadButton.textContent = "+ اختار صور موديل جديد";

const hint = document.createElement("p");
hint.textContent =
    "لعمل موديل جديد: اكتب اسمه واختار القسم ثم ارفع صوره.";
hint.style.cssText = "font-size:13px;color:#666;margin-top:10px;";
uploadPanel.appendChild(hint);

// =====================================
// 4. رفع موديل جديد وحفظه
// =====================================

imageUpload.addEventListener("change", async function () {
    if (!isReady) {
        alert("استنى لحد ما الموقع يجهز.");
        this.value = "";
        return;
    }

    const files = Array.from(this.files).filter(file =>
        file.type.startsWith("image/")
    );

    if (!files.length) {
        this.value = "";
        return;
    }

    const name = modelName.value.trim();

    if (!name) {
        alert("اكتب اسم الموديل الأول.");
        this.value = "";
        modelName.focus();
        return;
    }

    const product = {
        id: nextId++,
        name,
        category: categorySelect.value,
        images: files.map(file => ({
            fileName: file.name,
            blob: file
        })),
        mainImageIndex: 0
    };

    try {
        await saveProduct(product);
        prepareProduct(product);
        products.push(product);

        modelName.value = "";
        this.value = "";

        renderProducts();
        showMainImagePicker(product);
    } catch (error) {
        console.error(error);
        alert("حصلت مشكلة في حفظ الصور. تأكد من مساحة التخزين.");
    }
});

// =====================================
// 5. اختيار الصورة الرئيسية
// =====================================

function showMainImagePicker(product) {
    const oldPicker = uploadPanel.querySelector(".main-image-picker");
    if (oldPicker) oldPicker.remove();

    const picker = document.createElement("div");
    picker.className = "main-image-picker";

    const title = document.createElement("h3");
    title.textContent = "اختار الصورة الرئيسية: " + product.name;

    const grid = document.createElement("div");
    grid.className = "picker-grid";

    product.images.forEach((img, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "picker-image";

        const image = document.createElement("img");
        image.src = img.url;
        image.alt = "صورة " + (index + 1);

        const caption = document.createElement("span");
        caption.textContent = "الصورة " + (index + 1);

        button.append(image, caption);

        button.addEventListener("click", async () => {
            const previousIndex = product.mainImageIndex;
            product.mainImageIndex = index;

            try {
                await saveProduct(product);
                picker.remove();
                renderProducts();
            } catch (error) {
                product.mainImageIndex = previousIndex;
                alert("تعذر حفظ الصورة الرئيسية.");
            }
        });

        grid.appendChild(button);
    });

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "close-picker";
    closeButton.textContent = "إغلاق";

    closeButton.addEventListener("click", () => picker.remove());

    picker.append(title, grid, closeButton);
    uploadPanel.appendChild(picker);

    picker.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

// =====================================
// 6. الأقسام
// =====================================

categoryButtons.forEach(button => {
    button.addEventListener("click", () => {
        categoryButtons.forEach(item => item.classList.remove("active"));

        button.classList.add("active");
        selectedCategory = button.dataset.category;

        renderProducts();

        document.getElementById("products").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });
});

// =====================================
// 7. عرض الموديلات
// =====================================

function renderProducts() {
    const visibleProducts = selectedCategory === "all"
        ? products
        : products.filter(product =>
            product.category === selectedCategory
        );

    productCount.textContent = visibleProducts.length + " موديل";
    productGrid.innerHTML = "";

    if (!visibleProducts.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";

        const icon = document.createElement("span");
        icon.textContent = "🛍️";

        const heading = document.createElement("h3");
        heading.textContent = "مفيش موديلات في القسم ده لسه";

        const paragraph = document.createElement("p");
        paragraph.textContent = "اكتب اسم موديل وارفع صوره للبدء.";

        empty.append(icon, heading, paragraph);
        productGrid.appendChild(empty);
        return;
    }

    visibleProducts.forEach(product => {
        const card = document.createElement("article");
        card.className = "product-card";

        const mainImage = document.createElement("img");
        mainImage.src = product.images[product.mainImageIndex].url;
        mainImage.alt = product.name;
        mainImage.className = "product-main-image";

        const info = document.createElement("div");
        info.className = "product-info";

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.value = product.name;
        nameInput.className = "product-name-input";
        nameInput.setAttribute("aria-label", "اسم الموديل");

        nameInput.addEventListener("change", async () => {
            const oldName = product.name;
            product.name = nameInput.value.trim() || "موديل بدون اسم";

            try {
                await saveProduct(product);
                renderProducts();
            } catch (error) {
                product.name = oldName;
                alert("تعذر حفظ الاسم.");
            }
        });

        const category = document.createElement("p");
        category.className = "product-category";
        category.textContent = categories[product.category];

        const viewButton = document.createElement("button");
        viewButton.type = "button";
        viewButton.className = "view-images";
        viewButton.textContent =
            "عرض الصور (" + product.images.length + ")";

        viewButton.addEventListener("click", () => openGallery(product));

        // زر إضافة صور لنفس الموديل
        const addImagesButton = document.createElement("button");
        addImagesButton.type = "button";
        addImagesButton.className = "add-images";
        addImagesButton.textContent = "+ إضافة صور";

        addImagesButton.addEventListener("click", () => {
            chooseMoreImages(product);
        });

        // زر اختيار صورة رئيسية مختلفة
        const changeMainButton = document.createElement("button");
        changeMainButton.type = "button";
        changeMainButton.className = "change-main-image";
        changeMainButton.textContent = "تغيير الصورة الرئيسية";

        changeMainButton.addEventListener("click", () => {
            showMainImagePicker(product);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-product";
        deleteButton.textContent = "حذف الموديل";

        deleteButton.addEventListener("click", async () => {
            if (!confirm("هل أنت متأكد من حذف الموديل وكل صوره؟")) return;

            try {
                await deleteSavedProduct(product.id);
                releaseProductImages(product);
                products = products.filter(item => item.id !== product.id);
                renderProducts();
            } catch (error) {
                console.error(error);
                alert("تعذر حذف الموديل.");
            }
        });

        info.append(
            nameInput,
            category,
            viewButton,
            addImagesButton,
            changeMainButton,
            deleteButton
        );

        card.append(mainImage, info);
        productGrid.appendChild(card);
    });
}

// =====================================
// 8. إضافة صور جديدة لنفس الموديل
// =====================================

function chooseMoreImages(product) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;

    input.addEventListener("change", async () => {
        const files = Array.from(input.files).filter(file =>
            file.type.startsWith("image/")
        );

        if (!files.length) return;

        const oldImages = product.images;
        const newImages = files.map(file => ({
            fileName: file.name,
            blob: file,
            url: URL.createObjectURL(file)
        }));

        // نضيف الصور الجديدة مع الاحتفاظ بالصور القديمة
        product.images = [...oldImages, ...newImages];

        try {
            await saveProduct(product);
            renderProducts();
            alert("تمت إضافة " + files.length + " صورة للموديل بنجاح.");
        } catch (error) {
            product.images = oldImages;
            newImages.forEach(image => URL.revokeObjectURL(image.url));
            console.error(error);
            alert("تعذر حفظ الصور الجديدة. جرّب عدد صور أقل.");
        }
    });

    input.click();
}

// =====================================
// 9. معرض الصور
// =====================================

function openGallery(product) {
    if (activeGallery) activeGallery.remove();

    const overlay = document.createElement("div");
    overlay.className = "gallery-overlay";
    activeGallery = overlay;

    const dialog = document.createElement("div");
    dialog.className = "gallery-dialog";

    const close = document.createElement("button");
    close.className = "gallery-close";
    close.textContent = "✕";
    close.setAttribute("aria-label", "إغلاق المعرض");

    close.addEventListener("click", () => {
        overlay.remove();
        activeGallery = null;
    });

    const title = document.createElement("h2");
    title.textContent = product.name;

    const main = document.createElement("img");
    main.className = "gallery-main";
    main.src = product.images[product.mainImageIndex].url;
    main.alt = product.name;

    const count = document.createElement("p");
    count.className = "gallery-count";
    count.textContent = product.images.length + " صور للموديل";

    const thumbnails = document.createElement("div");
    thumbnails.className = "gallery-thumbnails";

    product.images.forEach((img, index) => {
        const thumb = document.createElement("button");
        thumb.type = "button";
        thumb.className = "gallery-thumb";

        const image = document.createElement("img");
        image.src = img.url;
        image.alt = "صورة " + (index + 1);

        thumb.appendChild(image);

        thumb.addEventListener("click", () => {
            main.src = img.url;
        });

        thumbnails.appendChild(thumb);
    });

    dialog.append(close, title, main, count, thumbnails);
    overlay.appendChild(dialog);

    overlay.addEventListener("click", event => {
        if (event.target === overlay) {
            overlay.remove();
            activeGallery = null;
        }
    });

    document.body.appendChild(overlay);
}

// =====================================
// 10. تصميم إضافي
// =====================================

const styles = document.createElement("style");

styles.textContent = `
    .product-card {
        background: white;
        border: 1px solid #e9edf0;
        border-radius: 14px;
        overflow: hidden;
        min-width: 0;
    }

    .product-main-image {
        width: 100%;
        aspect-ratio: 3/4;
        object-fit: cover;
        display: block;
        background: #eee;
    }

    .product-info {
        padding: 12px;
    }

    .product-name-input {
        width: 100%;
        box-sizing: border-box;
        padding: 9px;
        border: 1px solid #ddd;
        border-radius: 7px;
        font-family: inherit;
        font-weight: bold;
        direction: rtl;
    }

    .product-category {
        font-size: 12px;
        color: #77818c;
        margin: 8px 0;
    }

    .view-images, .delete-product, .add-images,
    .change-main-image, .close-picker {
        border: 0;
        padding: 9px 12px;
        border-radius: 7px;
        cursor: pointer;
        font-family: inherit;
        margin: 4px 3px 4px 0;
    }

    .view-images, .add-images, .change-main-image {
        background: #176b55;
        color: white;
    }

    .delete-product {
        background: #fff0f0;
        color: #b42318;
    }

    .main-image-picker {
        margin-top: 20px;
        padding: 15px;
        border: 1px solid #ddd;
        border-radius: 12px;
        background: white;
    }

    .main-image-picker h3 {
        font-size: 16px;
        margin-bottom: 12px;
    }

    .picker-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 10px;
    }

    .picker-image {
        border: 1px solid #ddd;
        background: white;
        padding: 5px;
        border-radius: 8px;
        cursor: pointer;
        font-family: inherit;
    }

    .picker-image img {
        width: 100%;
        aspect-ratio: 3/4;
        object-fit: cover;
        display: block;
    }

    .picker-image span {
        font-size: 11px;
    }

    .close-picker {
        margin-top: 12px;
        background: #eee;
    }

    .gallery-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(0,0,0,.75);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 15px;
        overflow-y: auto;
    }

    .gallery-dialog {
        position: relative;
        width: 100%;
        max-width: 650px;
        max-height: 95vh;
        overflow-y: auto;
        background: white;
        border-radius: 16px;
        padding: 20px;
        text-align: center;
    }

    .gallery-close {
        position: absolute;
        top: 10px;
        left: 10px;
        width: 38px;
        height: 38px;
        border: 0;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
    }

    .gallery-dialog h2 {
        padding: 25px 30px 12px;
        font-size: 21px;
    }

    .gallery-main {
        width: 100%;
        max-height: 55vh;
        object-fit: contain;
        border-radius: 10px;
        background: #f5f5f5;
    }

    .gallery-count {
        color: #666;
        font-size: 13px;
        margin: 10px;
    }

    .gallery-thumbnails {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding: 8px 0;
    }

    .gallery-thumb {
        flex: 0 0 75px;
        border: 1px solid #ddd;
        background: white;
        padding: 3px;
        border-radius: 6px;
        cursor: pointer;
    }

    .gallery-thumb img {
        width: 100%;
        height: 90px;
        object-fit: cover;
        display: block;
    }
`;

document.head.appendChild(styles);

// =====================================
// 11. تحميل البيانات المحفوظة
// =====================================

async function initializeApp() {
    try {
        await openDatabase();

        const savedProducts = await loadProducts();

        products = savedProducts.map(product => {
            nextId = Math.max(nextId, product.id + 1);
            return prepareProduct(product);
        });

        isReady = true;
        renderProducts();
    } catch (error) {
        console.error(error);
        alert("تعذر تحميل الموديلات المحفوظة. افتح الموقع من جديد.");
    }
}

initializeApp();
