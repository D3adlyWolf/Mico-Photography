// ===========================
//  FIREBASE INITIALIZATION
// ===========================
const firebaseConfig = {
    apiKey: "ATzaSyD-qhauRp6Vvm9p4Z4SUqKLSkrxT45rcZ4",
    authDomain: "mico-photography.firebaseapp.com",
    projectId: "mico-photography",
    storageBucket: "mico-photography.firebasestorage.app",
    messagingSenderId: "493967587966",
    appId: "1:493967587966:web:87f2e074c814dae2ab62f",
    measurementId: "G-GWK5LV9EEF"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const albumsRef = db.collection("albums"); // album index

// ===========================
//  OWNER PASSWORD
// ===========================
const OWNER_PASSWORD = "Quartz!Leaf%903$";

// ===========================
//  DOM ELEMENTS
// ===========================
const albumContainer = document.getElementById("album-container");
const albumView      = document.getElementById("album-view");
const albumViewTitle = document.getElementById("albumViewTitle");
const gallery        = document.getElementById("gallery");
const backToAlbums   = document.getElementById("backToAlbums");

const ownerBtn       = document.getElementById("ownerBtn");
const ownerPanel     = document.getElementById("ownerPanel");
const closeOwnerPanel= document.getElementById("closeOwnerPanel");

// tabs
const tabButtons     = document.querySelectorAll(".owner-tab");
const tabContents    = document.querySelectorAll(".owner-tab-content");

// albums tab
const newAlbumName   = document.getElementById("newAlbumName");
const albumCoverInput= document.getElementById("albumCoverInput");
const createAlbumBtn = document.getElementById("createAlbumBtn");
const ownerAlbumList = document.getElementById("ownerAlbumList");

// manage album tab
const manageAlbumHint    = document.getElementById("manageAlbumHint");
const manageAlbumSection = document.getElementById("manageAlbumSection");
const manageAlbumTitle   = document.getElementById("manageAlbumTitle");
const albumUploadInput   = document.getElementById("albumUploadInput");
const albumUploadBtn     = document.getElementById("albumUploadBtn");
const albumManagePhotos  = document.getElementById("albumManagePhotos");

// state
let currentManagedAlbumId   = null;
let currentManagedAlbumName = "";

// ===========================
//  UTIL: SLUGIFY & COMPRESS
// ===========================
function slugify(name) {
    const cleaned = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s_-]/g, "")
        .replace(/\s+/g, "_");
    return cleaned || ("album_" + Date.now());
}

// compress image to JPEG 0.7, max 1600px
async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const MAX_SIZE = 1600;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            const base64 = canvas.toDataURL("image/jpeg", 0.7);
            resolve(base64);
        };

        img.onerror = reject;

        const reader = new FileReader();
        reader.onload = e => { img.src = e.target.result; };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ===========================
//  GET ALBUM COVER
// ===========================
async function getAlbumCover(albumId, uploadedCover) {
    if (uploadedCover) return uploadedCover;

    try {
        const snap = await db.collection(albumId).limit(12).get();
        const candidates = snap.docs.filter(doc => doc.data().base64);
        if (candidates.length > 0) {
            const randomDoc = candidates[Math.floor(Math.random() * candidates.length)];
            return randomDoc.data().base64;
        }
    } catch (err) {
        console.error("Error getting album cover:", err);
    }

    return "https://placehold.co/600x400/1a1a1a/ffffff?text=Empty+Album";
}

// ===========================
//  LOAD ALBUM GRID (PUBLIC)
// ===========================
async function loadAlbums() {
    albumContainer.innerHTML = "";

    const snap = await albumsRef.orderBy("createdAt", "desc").get();

    for (const doc of snap.docs) {
        const album = doc.data();
        const albumId = doc.id;

        const card = document.createElement("div");
        card.className = "album-card";

        const img = document.createElement("img");
        img.className = "album-cover";
        img.src = await getAlbumCover(albumId, album.cover);

        const overlay = document.createElement("div");
        overlay.className = "album-name-overlay";
        overlay.textContent = album.name;

        card.appendChild(img);
        card.appendChild(overlay);

        card.addEventListener("click", () => openAlbum(albumId, album.name));

        albumContainer.appendChild(card);
    }
}

// ===========================
//  OPEN ALBUM (PUBLIC VIEW)
// ===========================
function openAlbum(albumId, albumName) {
    albumView.classList.remove("hidden");
    albumContainer.style.display = "none";

    backToAlbums.style.display = "block";
    albumViewTitle.textContent = albumName;
    gallery.innerHTML = "";

    db.collection(albumId)
        .orderBy("createdAt", "desc")
        .get()
        .then(snap => {
            snap.forEach((doc, index) => {
                const data = doc.data();
                if (!data.base64) return;

                const img = document.createElement("img");
                img.src = data.base64;
                img.className = "gallery-photo";
                img.addEventListener("click", () => openImageModal(data.base64));

                // stagger animation delay
                img.style.animationDelay = `${index * 0.08}s`;

                gallery.appendChild(img);
            });
        });
}

backToAlbums.addEventListener("click", () => {
    albumView.classList.add("hidden");
    albumContainer.style.display = "grid";
    backToAlbums.style.display = "none";
    albumViewTitle.textContent = "";
    gallery.innerHTML = "";
});

// ===========================
//  OWNER PANEL TABS
// ===========================
function switchOwnerTab(name) {
    tabButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === name);
    });
    tabContents.forEach(content => {
        content.classList.toggle("active", content.id === `tab-${name}`);
    });
}

tabButtons.forEach(btn => {
    btn.addEventListener("click", () => switchOwnerTab(btn.dataset.tab));
});

// ===========================
//  OWNER ALBUM LIST
// ===========================
async function loadOwnerAlbums() {
    ownerAlbumList.innerHTML = "";

    const snap = await albumsRef.orderBy("createdAt", "desc").get();

    for (const doc of snap.docs) {
        const album = doc.data();
        const albumId = doc.id;

        const row = document.createElement("div");
        row.className = "owner-album-row";

        const infoWrap = document.createElement("div");
        const nameEl = document.createElement("div");
        nameEl.className = "owner-album-name";
        nameEl.textContent = album.name;

        const subEl = document.createElement("div");
        subEl.className = "owner-album-sub";
        subEl.textContent = albumId;

        infoWrap.appendChild(nameEl);
        infoWrap.appendChild(subEl);

        const actions = document.createElement("div");
        actions.className = "owner-album-actions";

        const manageBtn = document.createElement("button");
        manageBtn.className = "action-btn action-primary";
        manageBtn.textContent = "Manage";
        manageBtn.addEventListener("click", () => openManageAlbum(albumId, album.name));
        actions.appendChild(manageBtn);

        const delBtn = document.createElement("button");
        delBtn.className = "action-btn action-danger";
        delBtn.textContent = "Delete";
        delBtn.addEventListener("click", async () => {
            if (!confirm(`Delete album "${album.name}" and ALL its photos?`)) return;

            const photosSnap = await db.collection(albumId).get();
            for (const p of photosSnap.docs) {
                await db.collection(albumId).doc(p.id).delete();
            }

            await albumsRef.doc(albumId).delete();

            if (currentManagedAlbumId === albumId) {
                currentManagedAlbumId = null;
                currentManagedAlbumName = "";
                manageAlbumSection.classList.add("hidden");
                manageAlbumHint.classList.remove("hidden");
                albumManagePhotos.innerHTML = "";
                manageAlbumTitle.textContent = "";
            }

            await loadOwnerAlbums();
            await loadAlbums();
        });
        actions.appendChild(delBtn);

        row.appendChild(infoWrap);
        row.appendChild(actions);
        ownerAlbumList.appendChild(row);
    }
}

// create album
createAlbumBtn.addEventListener("click", async () => {
    const nameRaw = newAlbumName.value.trim();
    if (!nameRaw) return alert("Enter an album name.");

    const albumId = slugify(nameRaw);

    const exists = await albumsRef.doc(albumId).get();
    if (exists.exists) {
        return alert("An album with a similar ID already exists.");
    }

    let coverBase64 = null;
    if (albumCoverInput.files.length > 0) {
        try {
            coverBase64 = await compressImage(albumCoverInput.files[0]);
        } catch (err) {
            console.error("Error compressing cover:", err);
            alert("Error processing cover image.");
        }
    }

    await albumsRef.doc(albumId).set({
        name: nameRaw,
        cover: coverBase64 || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    newAlbumName.value = "";
    albumCoverInput.value = "";

    await loadOwnerAlbums();
    await loadAlbums();

    alert("Album created.");
});

// ===========================
//  MANAGE ALBUM
// ===========================
function openManageAlbum(albumId, albumName) {
    currentManagedAlbumId = albumId;
    currentManagedAlbumName = albumName;

    manageAlbumTitle.textContent = albumName + " (" + albumId + ")";
    manageAlbumHint.classList.add("hidden");
    manageAlbumSection.classList.remove("hidden");

    switchOwnerTab("manage");
    loadManagedAlbumPhotos();
}

// load photos
async function loadManagedAlbumPhotos() {
    if (!currentManagedAlbumId) {
        albumManagePhotos.innerHTML = "";
        return;
    }

    albumManagePhotos.innerHTML = "";

    const snap = await db.collection(currentManagedAlbumId)
        .orderBy("createdAt", "desc")
        .get();

    snap.forEach(doc => {
        const data = doc.data();
        if (!data.base64) return;

        const row = document.createElement("div");
        row.className = "owner-photo-row";

        const img = document.createElement("img");
        img.src = data.base64;
        img.className = "owner-thumb";

        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.className = "delete-btn";

        delBtn.addEventListener("click", async () => {
            if (!confirm("Delete this photo?")) return;
            await db.collection(currentManagedAlbumId).doc(doc.id).delete();
            row.remove();
        });

        row.appendChild(img);
        row.appendChild(delBtn);
        albumManagePhotos.appendChild(row);
    });
}

// upload photos
albumUploadBtn.addEventListener("click", async () => {
    if (!currentManagedAlbumId) {
        alert("Select an album to manage first in the Albums tab.");
        return;
    }

    const files = albumUploadInput.files;
    if (!files.length) return alert("Select at least one image.");

    albumUploadBtn.disabled = true;
    albumUploadBtn.textContent = "Uploading...";

    try {
        for (const file of files) {
            const base64 = await compressImage(file);

            if (base64.length > 1000000) {
                alert("A photo was still too large after compression and was skipped.");
                continue;
            }

            await db.collection(currentManagedAlbumId).add({
                base64,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        albumUploadInput.value = "";
        await loadManagedAlbumPhotos();
        await loadAlbums();
    } catch (err) {
        console.error("Upload error:", err);
        alert("Error uploading one or more photos. Check console.");
    } finally {
        albumUploadBtn.disabled = false;
        albumUploadBtn.textContent = "Upload to this album";
    }
});

// ===========================
//  OWNER PANEL OPEN/CLOSE
// ===========================
ownerBtn.addEventListener("click", async () => {
    const input = prompt("Enter owner password:");
    if (input !== OWNER_PASSWORD) {
        alert("Incorrect password.");
        return;
    }

    ownerPanel.classList.remove("hidden");
    currentManagedAlbumId = null;
    currentManagedAlbumName = "";
    manageAlbumHint.classList.remove("hidden");
    manageAlbumSection.classList.add("hidden");
    manageAlbumTitle.textContent = "";
    albumManagePhotos.innerHTML = "";

    switchOwnerTab("albums");
    await loadOwnerAlbums();
});

closeOwnerPanel.addEventListener("click", () => {
    ownerPanel.classList.add("hidden");
});

// ===========================
//  INITIAL STARTUP
// ===========================
(async () => {
    await loadAlbums();
})();

// ===========================
//  FULLSCREEN VIEWER
// ===========================
function openImageModal(src) {
    const overlay = document.createElement("div");
    overlay.className = "image-modal";

    const img = document.createElement("img");
    img.src = src;
    img.className = "image-modal-img";

    overlay.appendChild(img);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", () => overlay.remove());
}

// ===========================
//  LOGO ANTI-THEFT
// ===========================
document.querySelector(".logo").addEventListener("contextmenu", e => e.preventDefault());
document.querySelector(".logo").addEventListener("dragstart", e => e.preventDefault());
document.querySelector(".logo").addEventListener("touchstart", e => e.preventDefault(), { passive: false });
document.querySelector(".logo").addEventListener("touchmove", e => e.preventDefault(), { passive: false });
document.getElementById("logo-shield").addEventListener("contextmenu", e => e.preventDefault());
