// Utility to fix direct message channel names to only show the other user's name
export const fixDirectMessageChannelNames = async (client, currentUserId) => {
  try {
    // Get all channels for the current user
    const filter = { 
      type: 'messaging',
      members: { $in: [currentUserId] } 
    };
    
    const channels = await client.queryChannels(filter);
    
    for (const channel of channels) {
      const members = Object.values(channel.state.members);
      
      // Check if it's a direct message (2 members)
      if (members.length === 2) {
        // Find the other user
        const otherUser = members.find(m => m.user.id !== currentUserId);
        
        if (otherUser && channel.data.name && channel.data.name.includes('&')) {
          // Update channel name to just show the other user's name
          console.log(`Updating channel ${channel.cid} name to: ${otherUser.user.name}`);
          
          await channel.updatePartial({
            set: {
              name: otherUser.user.name || otherUser.user.id
            }
          });
        }
      }
    }
    
    console.log('Channel names fixed successfully');
    return true;
  } catch (error) {
    console.error('Error fixing channel names:', error);
    return false;
  }
};