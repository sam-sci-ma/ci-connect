"use client"

import { useState } from "react"
import Modal from "./modal"
import { Button } from "./button"

interface AlertModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
}

export default function AlertModal({ isOpen, onClose, title, message, type = 'info' }: AlertModalProps) {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓'
      case 'warning':
        return '⚠'
      case 'error':
        return '✕'
      default:
        return 'ℹ'
    }
  }

  const getColorClass = () => {
    switch (type) {
      case 'success':
        return 'text-green-400'
      case 'warning':
        return 'text-yellow-400'
      case 'error':
        return 'text-red-400'
      default:
        return 'text-violet-400'
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false}>
      <div className="text-center">
        <div className={`text-4xl mb-4 ${getColorClass()}`}>
          {getIcon()}
        </div>
        {title && (
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        )}
        <p className="text-gray-300 mb-6">{message}</p>
        <Button onClick={onClose} className="w-full">
          OK
        </Button>
      </div>
    </Modal>
  )
}

// Hook for managing alert modal state
export function useAlertModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [alertData, setAlertData] = useState<{
    title?: string
    message: string
    type?: 'info' | 'success' | 'warning' | 'error'
  } | null>(null)

  const showAlert = (message: string, title?: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setAlertData({ title, message, type })
    setIsOpen(true)
  }

  const closeAlert = () => {
    setIsOpen(false)
    setAlertData(null)
  }

  return {
    isOpen,
    alertData,
    showAlert,
    closeAlert
  }
}