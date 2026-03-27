import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { HiArrowLeft, HiPhotograph, HiX } from 'react-icons/hi'
import Layout from '../../components/Layout/Layout'
import styles from './PostMemory.module.css'

export default function PostMemory() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const isEditing = !!id

  const [form, setForm] = useState({
    title: '',
    story: '',
    quote: '',
    date: '',
    location: '',
    category: '',
    type: searchParams.get('type') || 'memory'
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [existingImageUrl, setExistingImageUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    async function fetchMemory() {
      const docSnap = await getDoc(doc(db, 'memories', id))
      if (docSnap.exists()) {
        const data = docSnap.data()
        const d = data.date?.toDate ? data.date.toDate() : new Date(data.date)
        setForm({
          title: data.title || '',
          story: data.story || '',
          quote: data.quote || '',
          date: d ? d.toISOString().split('T')[0] : '',
          location: data.location || '',
          category: data.category || '',
          type: data.type || 'memory'
        })
        setExistingImageUrl(data.imageUrl)
      }
    }
    fetchMemory()
  }, [id])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
    setExistingImageUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function uploadImage(base64) {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    return data
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let imageUrl = existingImageUrl || ''
      let thumbnailUrl = ''

      if (imageFile) {
        const reader = new FileReader()
        const base64 = await new Promise((resolve) => {
          reader.onload = (ev) => resolve(ev.target.result)
          reader.readAsDataURL(imageFile)
        })
        const uploadResult = await uploadImage(base64)
        imageUrl = uploadResult.imageUrl
        thumbnailUrl = uploadResult.thumbnailUrl
      }

      const memoryData = {
        title: form.title,
        story: form.story,
        quote: form.quote,
        date: form.date ? new Date(form.date) : new Date(),
        location: form.location,
        category: form.category,
        type: form.type,
        imageUrl,
        thumbnailUrl: thumbnailUrl || imageUrl,
        updatedAt: serverTimestamp()
      }

      if (isEditing) {
        await updateDoc(doc(db, 'memories', id), memoryData)
      } else {
        memoryData.createdAt = serverTimestamp()
        await addDoc(collection(db, 'memories'), memoryData)
      }

      navigate('/home')
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const previewSrc = imagePreview || existingImageUrl

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <button onClick={() => navigate(-1)} className={styles.backButton}>
            <HiArrowLeft />
          </button>
          <h1 className={styles.title}>
            {isEditing ? 'Edit Memory' : form.type === 'moment' ? 'Add a Moment' : 'Post a Memory'}
          </h1>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.card}>
            <label className={styles.fieldLabel}>Type</label>
            <div className={styles.typeToggle}>
              <button
                type="button"
                className={`${styles.typeButton} ${form.type === 'memory' ? styles.typeButtonActive : ''}`}
                onClick={() => setForm({ ...form, type: 'memory' })}
              >
                Memory
              </button>
              <button
                type="button"
                className={`${styles.typeButton} ${form.type === 'moment' ? styles.typeButtonActive : ''}`}
                onClick={() => setForm({ ...form, type: 'moment' })}
              >
                Daily Moment
              </button>
            </div>
          </div>

          <div className={styles.card}>
            <label className={styles.fieldLabel}>Photo</label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {!previewSrc ? (
              <div
                className={styles.uploadArea}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className={styles.uploadIcon}><HiPhotograph /></div>
                <p className={styles.uploadText}>Click to upload a photo</p>
                <p className={styles.uploadHint}>JPG, PNG up to 10MB</p>
              </div>
            ) : (
              <div className={styles.preview}>
                <img src={previewSrc} alt="Preview" />
                <button type="button" className={styles.removePreview} onClick={removeImage}>
                  <HiX />
                </button>
              </div>
            )}
          </div>

          <div className={styles.card}>
            <label className={styles.fieldLabel}>Title</label>
            <input
              type="text"
              name="title"
              className={styles.input}
              value={form.title}
              onChange={handleChange}
              placeholder="Give this memory a title"
              required
            />

            {form.type === 'memory' && (
              <>
                <label className={styles.fieldLabel}>Quote</label>
                <input
                  type="text"
                  name="quote"
                  className={styles.input}
                  value={form.quote}
                  onChange={handleChange}
                  placeholder="A memorable quote (optional)"
                />

                <label className={styles.fieldLabel}>Story</label>
                <textarea
                  name="story"
                  className={styles.textarea}
                  value={form.story}
                  onChange={handleChange}
                  placeholder="Tell the story behind this memory..."
                />
              </>
            )}

            <div className={styles.row}>
              <div>
                <label className={styles.fieldLabel}>Date</label>
                <input
                  type="date"
                  name="date"
                  className={styles.input}
                  value={form.date}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className={styles.fieldLabel}>Location</label>
                <input
                  type="text"
                  name="location"
                  className={styles.input}
                  value={form.location}
                  onChange={handleChange}
                  placeholder="Where was this?"
                />
              </div>
            </div>

            <label className={styles.fieldLabel}>Category</label>
            <input
              type="text"
              name="category"
              className={styles.input}
              value={form.category}
              onChange={handleChange}
              placeholder="e.g. Summer Solstice, Birthday, Holiday"
            />
          </div>

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? 'Saving...' : isEditing ? 'Update Memory' : 'Share This Memory'}
          </button>
        </form>
      </div>
    </Layout>
  )
}
