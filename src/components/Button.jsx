import React from 'react'
import { cn } from '../lib/utils'

export const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        {
          "bg-blue-600 text-white hover:bg-blue-700": variant === "default",
          "bg-gray-100 text-gray-900 hover:bg-gray-200": variant === "secondary",
        },
        {
          "h-10 px-4 py-2": size === "default",
          "h-9 px-3": size === "sm",
          "h-11 px-8": size === "lg",
        },
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"
