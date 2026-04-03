import React from 'react';
import { IoCheckmarkCircle, IoAlertCircle, IoWarning, IoInformationCircle, IoClose } from 'react-icons/io5';

const NotificationContainer = ({ notifications, onRemove }) => {
    const getNotificationIcon = (type) => {
        switch (type) {
            case 'success':
                return <IoCheckmarkCircle className="text-green-500 text-xl" />;
            case 'error':
                return <IoAlertCircle className="text-red-500 text-xl" />;
            case 'warning':
                return <IoWarning className="text-yellow-500 text-xl" />;
            case 'info':
                return <IoInformationCircle className="text-blue-500 text-xl" />;
            default:
                return <IoInformationCircle className="text-gray-500 text-xl" />;
        }
    };

    const getNotificationStyles = (type) => {
        switch (type) {
            case 'success':
                return 'bg-green-50 border-green-200 text-green-800';
            case 'error':
                return 'bg-red-50 border-red-200 text-red-800';
            case 'warning':
                return 'bg-yellow-50 border-yellow-200 text-yellow-800';
            case 'info':
                return 'bg-blue-50 border-blue-200 text-blue-800';
            default:
                return 'bg-gray-50 border-gray-200 text-gray-800';
        }
    };

    return (
        <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm w-full pointer-events-none">
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    className={`p-4 rounded-lg border-2 shadow-lg transform transition-all duration-300 pointer-events-auto ${
                        notification.visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
                    } ${getNotificationStyles(notification.type)}`}
                >
                    <div className="flex items-start space-x-3">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm">{notification.title}</h4>
                            <p className="text-sm mt-1">{notification.message}</p>
                        </div>
                        <button
                            onClick={() => onRemove(notification.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <IoClose className="text-lg" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default NotificationContainer;
