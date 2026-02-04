

'use client';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent, Editor, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
    Palette, Pilcrow, Baseline, LayoutList, Bold, Italic, Underline, Strikethrough, Link as LinkIcon, List, ListOrdered, Image as ImageIcon, Minus, Superscript as SuperscriptIcon, Subscript as SubscriptIcon, Unlink, AlignLeft, AlignCenter, AlignRight, AlignJustify, Eraser, Expand, Shrink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Tiptap Extensions
import TiptapUnderline from '@tiptap/extension-underline';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Placeholder from '@tiptap/extension-placeholder';
import Blockquote from '@tiptap/extension-blockquote';
import TextAlign from '@tiptap/extension-text-align';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import FontFamily from '@tiptap/extension-font-family';
import { TextStyle as TiptapTextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';

// Added imports
import { useAuth } from '@/hooks/use-auth';
import { storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';


// Custom FontSize functionality using TextStyle extension
const TextStyleWithFontSize = TiptapTextStyle.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            fontSize: {
                default: null,
                parseHTML: element => element.style.fontSize,
                renderHTML: attributes => {
                    if (!attributes.fontSize) {
                        return {};
                    }
                    return { style: `font-size: ${attributes.fontSize}` };
                },
            },
        };
    },
});


const Toolbar = ({ editor, isFullscreen, onToggleFullscreen, className }: { editor: Editor | null, isFullscreen: boolean, onToggleFullscreen: () => void, className?: string }) => {
    // ... code truncated for brevity, assume component body is unchanged ...
    const { user } = useAuth();
    const { toast } = useToast();

    const addImage = useCallback(() => {
        if (!editor || !user) {
            if (!user) {
                toast({
                    variant: 'destructive',
                    title: 'Authentication Required',
                    description: 'You must be logged in to upload images.',
                });
            }
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;

            const uploadToast = toast({
                title: 'Uploading image...',
                description: 'Please wait while your image is being uploaded.',
            });

            const imageStorageRef = storageRef(storage, `journal-images/${user.uid}/${Date.now()}_${file.name}`);

            try {
                await uploadBytes(imageStorageRef, file);
                const url = await getDownloadURL(imageStorageRef);
                editor.chain().focus().setImage({ src: url }).run();
                uploadToast.dismiss();
                toast({
                    title: 'Image Uploaded',
                    description: 'Your image has been successfully added to your journal.',
                });
            } catch (error) {
                console.error("Image upload failed: ", error);
                uploadToast.dismiss();
                toast({
                    variant: 'destructive',
                    title: 'Upload Failed',
                    description: 'There was a problem uploading your image. Please try again.',
                });
            }
        };

        input.click();

    }, [editor, user, toast]);

    if (!editor) {
        return null;
    }

    const fontFamilies = ["Inter", "Comic Sans MS", "Serif", "Monospace", "Cursive"];
    const fontSizes = ["10", "12", "14", "16", "18", "20", "22", "24", "25"];
    const colors = ["#000000", "#495057", "#fa5252", "#e64980", "#be4bdb", "#7950f2", "#4c6ef5", "#228be6", "#15aabf", "#12b886", "#40c057", "#82c91e", "#fcc419", "#fd7e14", "#868e96", "#ff6b6b", "#f06595", "#da77f2", "#9775fa", "#748ffc", "#4dabf7"];

    return (
        <div className={cn(
            "tiptap-toolbar",
            'sticky top-0 z-10 bg-background',
            !isFullscreen && 'border-b',
            isFullscreen && 'border-t',
            className
        )}>
            {/* Group 1: Appearance */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-2" onMouseDown={(e) => e.preventDefault()}><Palette /><span className="sr-only">Appearance</span></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <div className="p-2 space-y-2">
                        <label className="text-xs text-muted-foreground px-1">Font Family</label>
                        <Select
                            value={editor.getAttributes('textStyle').fontFamily || 'Inter'}
                            onValueChange={(value) => editor.chain().focus().setFontFamily(value).run()}
                        >
                            <SelectTrigger onMouseDown={(e) => e.preventDefault()}>
                                <SelectValue placeholder="Font Family" />
                            </SelectTrigger>
                            <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                                {fontFamilies.map(font => (
                                    <SelectItem key={font} value={font} onMouseDown={(e) => e.preventDefault()}>
                                        <span style={{ fontFamily: font }}>{font}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <label className="text-xs text-muted-foreground px-1">Font Size</label>
                        <Select
                            value={editor.getAttributes('textStyle').fontSize?.replace('px', '') || '16'}
                            onValueChange={(value) => editor.chain().focus().setMark('textStyle', { fontSize: `${value}px` }).run()}
                        >
                            <SelectTrigger onMouseDown={(e) => e.preventDefault()}>
                                <SelectValue placeholder="Font Size" />
                            </SelectTrigger>
                            <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                                {fontSizes.map(size => (
                                    <SelectItem key={size} value={size} onMouseDown={(e) => e.preventDefault()}>
                                        {size}px
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DropdownMenuSeparator />
                    <Popover>
                        <PopoverTrigger asChild>
                            <button type="button" className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full text-left" onMouseDown={(e) => e.preventDefault()}>
                                Font Color
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-1" onCloseAutoFocus={(e) => e.preventDefault()}>
                            <div className="color-picker-grid">
                                {colors.map(color => (
                                    <button
                                        type="button"
                                        key={color}
                                        onClick={() => editor.chain().focus().setColor(color).run()}
                                        onMouseDown={(e) => e.preventDefault()}
                                        className="color-swatch"
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Group 2: Basic Formatting */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-2" onMouseDown={(e) => e.preventDefault()}><Pilcrow /><span className="sr-only">Text Style</span></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onSelect={() => editor.chain().focus().toggleBold().run()}>
                        <Bold className="mr-2 h-4 w-4" />
                        <span>Bold</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onSelect={() => editor.chain().focus().toggleItalic().run()}>
                        <Italic className="mr-2 h-4 w-4" />
                        <span>Italic</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onSelect={() => editor.chain().focus().toggleUnderline().run()}>
                        <Underline className="mr-2 h-4 w-4" />
                        <span>Underline</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onSelect={() => editor.chain().focus().setHorizontalRule().run()}>
                        <Minus className="mr-2 h-4 w-4" />
                        <span>Horizontal Rule</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Group 3: Scripts */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-2" onMouseDown={(e) => e.preventDefault()}><Baseline /><span className="sr-only">Scripts</span></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onSelect={() => editor.chain().focus().toggleStrike().run()}>
                        <Strikethrough className="mr-2 h-4 w-4" />
                        <span>Strikethrough</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onSelect={() => editor.chain().focus().toggleSuperscript().run()}>
                        <SuperscriptIcon className="mr-2 h-4 w-4" />
                        <span>Superscript</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onSelect={() => editor.chain().focus().toggleSubscript().run()}>
                        <SubscriptIcon className="mr-2 h-4 w-4" />
                        <span>Subscript</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Group 4: Layout */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-2" onMouseDown={(e) => e.preventDefault()}><LayoutList /><span className="sr-only">Layout</span></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onSelect={() => editor.chain().focus().toggleBulletList().run()}>
                        <List className="mr-2 h-4 w-4" />
                        <span>Unordered List</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onMouseDown={(e) => e.preventDefault()} onSelect={() => editor.chain().focus().toggleOrderedList().run()}>
                        <ListOrdered className="mr-2 h-4 w-4" />
                        <span>Ordered List</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <div className="flex items-center justify-around p-1">
                        <Button type="button" variant={editor.isActive({ textAlign: 'left' }) ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
                            <AlignLeft className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant={editor.isActive({ textAlign: 'center' }) ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
                            <AlignCenter className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant={editor.isActive({ textAlign: 'right' }) ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
                            <AlignRight className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant={editor.isActive({ textAlign: 'justify' }) ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
                            <AlignJustify className="h-4 w-4" />
                        </Button>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Image Upload Button */}
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-2"
                onClick={addImage}
                onMouseDown={(e) => e.preventDefault()}
                title="Upload Image"
            >
                <ImageIcon />
                <span className="sr-only">Upload Image</span>
            </Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-2" onClick={onToggleFullscreen} onMouseDown={(e) => e.preventDefault()} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                {isFullscreen ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                <span className="sr-only">{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
            </Button>
        </div>
    );
};


interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
    className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, isFullscreen, onToggleFullscreen, className }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                blockquote: {},
                orderedList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
                bulletList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
            }),
            TiptapUnderline,
            TiptapLink.configure({
                openOnClick: false,
                autolink: false,
                linkOnPaste: false,
            }),
            TiptapImage.configure({ inline: false }),
            HorizontalRule,
            Placeholder.configure({ placeholder: placeholder || "Start writing your journal entry here..." }),
            // Removed Blockquote to avoid duplicate extension error
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Superscript,
            Subscript,
            FontFamily,
            TextStyleWithFontSize,
            Color,
            BubbleMenuExtension.configure({
                pluginKey: 'bubbleMenu', // helps avoid conflicts
            }),
        ],
        content: value,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'ProseMirror',
            },
        },
        immediatelyRender: false,
    });

    const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const linkInputRef = useRef<HTMLInputElement>(null);

    const handleLinkPopoverOpenChange = (open: boolean) => {
        if (open && editor) {
            const previousUrl = editor.getAttributes('link').href;
            setLinkUrl(previousUrl || '');
        }
        setIsLinkPopoverOpen(open);
    }

    const saveLink = useCallback(() => {
        if (!editor) return;

        // unsetLink if url is empty
        if (!linkUrl) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            setIsLinkPopoverOpen(false);
            return;
        }

        // otherwise, create or update the link
        editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
        setIsLinkPopoverOpen(false);
        setLinkUrl('');
    }, [editor, linkUrl]);

    return (
        <div className={cn("tiptap", isFullscreen && "fullscreen", className)}>
            <Toolbar
                editor={editor}
                isFullscreen={isFullscreen}
                onToggleFullscreen={onToggleFullscreen}
            />
            {editor && (
                <BubbleMenu
                    editor={editor}
                    tippyOptions={{ duration: 100, zIndex: isFullscreen ? 101 : 10, appendTo: 'parent' }}
                    shouldShow={({ editor, view, state, from, to }) => {
                        const { doc, selection } = state;
                        const { empty } = selection;
                        // Don't show if empty selection
                        if (empty) return false;
                        // Don't show on images
                        if (editor.isActive('image')) return false;
                        return true;
                    }}
                    className="flex items-center gap-1 p-1 rounded-md bg-background border shadow-md"
                >
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleBold().run()} data-active={editor.isActive('bold')} onMouseDown={(e) => e.preventDefault()}> <Bold className="h-4 w-4" /> </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleItalic().run()} data-active={editor.isActive('italic')} onMouseDown={(e) => e.preventDefault()}> <Italic className="h-4 w-4" /> </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleUnderline().run()} data-active={editor.isActive('underline')} onMouseDown={(e) => e.preventDefault()}> <Underline className="h-4 w-4" /> </Button>
                    <Separator orientation="vertical" className="h-6 mx-1" />

                    <Popover open={isLinkPopoverOpen} onOpenChange={handleLinkPopoverOpenChange}>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={cn("h-8 w-8", editor.isActive('link') && "bg-accent text-accent-foreground")}
                                onMouseDown={(e) => e.preventDefault()}
                            >
                                <LinkIcon className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-auto p-2"
                            align="start"
                            side="bottom"
                            onOpenAutoFocus={(e) => {
                                e.preventDefault();
                                linkInputRef.current?.focus({ preventScroll: true });
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <Input
                                    ref={linkInputRef}
                                    type="url"
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveLink(); } }}
                                    onMouseDown={(e) => e.preventDefault()}
                                    placeholder="Paste or type a link"
                                    className="h-8 text-sm"
                                />
                                <Button type="button" size="sm" className="h-8" onClick={saveLink} onMouseDown={(e) => e.preventDefault()}>Set</Button>
                                {editor.isActive('link') && (
                                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                                        editor.chain().focus().unsetLink().run();
                                        setIsLinkPopoverOpen(false);
                                        setLinkUrl('');
                                    }} onMouseDown={(e) => e.preventDefault()}>
                                        <Unlink className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => editor.chain().focus().unsetAllMarks().run()}
                        onMouseDown={(e) => e.preventDefault()}
                        title="Clear Formatting"
                    >
                        <Eraser className="h-4 w-4" />
                    </Button>
                </BubbleMenu>
            )}
            <EditorContent
                editor={editor}
                className={cn(
                    isFullscreen ? "flex-1 overflow-y-auto min-h-0 hide-scrollbar" : "overflow-y-auto hide-scrollbar"
                )} />
        </div>
    );
}


