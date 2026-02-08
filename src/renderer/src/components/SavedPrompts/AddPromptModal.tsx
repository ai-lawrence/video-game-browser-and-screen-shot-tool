import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react'

interface AddPromptModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (title: string, text: string, icon: string) => void
}

const AddPromptModal: React.FC<AddPromptModalProps> = ({ isOpen, onClose, onSave }) => {
    const [title, setTitle] = useState('')
    const [text, setText] = useState('')
    const [icon, setIcon] = useState('💬')
    const [showPicker, setShowPicker] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setTitle('')
            setText('')
            setIcon('💬')
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim() || !text.trim()) return
        onSave(title, text, icon)
        onClose()
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Add New Prompt</h3>
                    <button onClick={onClose} className="close-btn">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Fix Grammar"
                            maxLength={40}
                            required
                        />
                    </div>
                    <div className="form-group" style={{ position: 'relative' }}>
                        <label>Icon (Emoji)</label>
                        <button type="button" className="emoji-btn" onClick={() => setShowPicker(!showPicker)}>
                            {icon}
                        </button>
                        {showPicker && (
                            <div className="emoji-picker-container">
                                <EmojiPicker
                                    onEmojiClick={(emojiData) => {
                                        setIcon(emojiData.emoji)
                                        setShowPicker(false)
                                    }}
                                    theme={Theme.DARK}
                                    emojiStyle={EmojiStyle.NATIVE}
                                    lazyLoadEmojis={true}
                                />
                            </div>
                        )}
                    </div>
                    <div className="form-group">
                        <label>Prompt Text</label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Enter your prompt here..."
                            rows={6}
                            maxLength={4000}
                            required
                        />
                    </div>
                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="btn-cancel">
                            Cancel
                        </button>
                        <button type="submit" className="btn-save">
                            Save Prompt
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default AddPromptModal
